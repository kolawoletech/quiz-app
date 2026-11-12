"use server";

import { z } from "zod";

import { FieldValue } from "firebase-admin/firestore";

import { getFirebaseAdminAuth, getFirebaseAdminFirestore } from "@/lib/firebase-admin";
import { gradeStudentQuizSubmission } from "@/lib/quiz-utils";
import { getQuizByRoomCode } from "@/lib/quiz-store";
import type {
  LoadStudentSessionResult,
  StudentAnswerReviewResult,
  StudentSubmissionResult,
} from "@/lib/student-quiz";

const roomCodeSchema = z.string().trim().regex(/^\d{4}$/, "Enter a four-digit room code.");
const submissionResultSchema = z.object({
  score: z.number().nullable(),
  maxScore: z.number().nullable(),
  questionResults: z.array(z.object({
    questionId: z.string(),
    isCorrect: z.boolean(),
    earnedPoints: z.number(),
    possiblePoints: z.number(),
    correctAnswer: z.string().optional(),
    explanation: z.string().optional(),
  })).nullable(),
});

const submissionSchema = z.object({
  roomCode: roomCodeSchema,
  answers: z.record(z.string(), z.array(z.string().max(5000)).max(100)),
  displayName: z.string().trim().max(40).optional(),
  attemptId: z.string().uuid(),
  idToken: z.string().min(1).max(10_000),
});

const savedSubmissionSchema = z.object({
  participantUid: z.string(),
  answers: z.record(z.string(), z.array(z.string().max(5000)).max(100)),
});

const answerReviewRequestSchema = z.object({
  roomCode: roomCodeSchema,
  attemptId: z.string().uuid(),
  idToken: z.string().min(1).max(10_000),
});

async function findQuiz(roomCode: string) {
  return getQuizByRoomCode(roomCode);
}

async function verifyAnonymousStudent(idToken: string) {
  const decodedToken = await getFirebaseAdminAuth().verifyIdToken(idToken, true);
  if (decodedToken.firebase.sign_in_provider !== "anonymous") {
    throw new Error("Join with an anonymous student session before continuing.");
  }
  return decodedToken;
}

export async function loadStudentSession(rawRoomCode: string, rawIdToken: unknown): Promise<LoadStudentSessionResult> {
  const parsedRoomCode = roomCodeSchema.safeParse(rawRoomCode);
  if (!parsedRoomCode.success) {
    return { ok: false, error: parsedRoomCode.error.issues[0]?.message ?? "Enter a valid room code." };
  }

  const parsedIdToken = z.string().min(1).max(10_000).safeParse(rawIdToken);
  if (!parsedIdToken.success) {
    return { ok: false, error: "Start an anonymous student session and try again." };
  }

  const decodedToken = await verifyAnonymousStudent(parsedIdToken.data);
  const storedQuiz = await findQuiz(parsedRoomCode.data);
  if (!storedQuiz) {
    return {
      ok: false,
      error: "That room is not accepting responses. Check the code or ask your lecturer to start the session.",
    };
  }

  const { quiz, questions } = storedQuiz;
  const submissions = await getFirebaseAdminFirestore()
    .collection("quizzes")
    .doc(quiz.id)
    .collection("submissions")
    .where("participantUid", "==", decodedToken.uid)
    .get();
  const attemptsUsed = submissions.size;
  const attemptsRemaining = Math.max(0, quiz.settings.attemptLimit - attemptsUsed);
  const answerReviewAvailable = quiz.settings.showCorrectAnswersAfterSubmit || quiz.answerReviewReleased;

  const session = {
    roomCode: parsedRoomCode.data,
    title: quiz.title,
    description: quiz.description,
    attemptsUsed,
    attemptsRemaining,
    attemptLimit: quiz.settings.attemptLimit,
    canAttempt: quiz.status === "published" && attemptsRemaining > 0,
    settings: {
      shuffleQuestions: quiz.settings.shuffleQuestions,
      shuffleOptions: quiz.settings.shuffleOptions,
      showScoreAfterSubmit: quiz.settings.showScoreAfterSubmit,
      showCorrectAnswersAfterSubmit: quiz.settings.showCorrectAnswersAfterSubmit,
      passMark: quiz.settings.passMark,
      timeLimitMinutes: quiz.settings.timeLimitMinutes,
    },
    questions: questions.map(({ id, type, question, codeSnippet, options, matchItems, points }) => ({
      id,
      type,
      question,
      codeSnippet,
      options,
      ...(matchItems ? { matchItems } : {}),
      points,
    })),
  };

  if (answerReviewAvailable && attemptsUsed > 0) {
    const latestSubmission = submissions.docs
      .map((document) => ({ document, submittedAt: document.get("submittedAt") }))
      .sort((left, right) => {
        const getTime = (value: unknown) => {
          if (value instanceof Date) return value.getTime();
          if (typeof value !== "object" || value === null || !("toDate" in value) || typeof value.toDate !== "function") return 0;
          const date = value.toDate();
          return date instanceof Date ? date.getTime() : 0;
        };
        return getTime(right.submittedAt) - getTime(left.submittedAt);
      })[0]?.document;
    const savedSubmission = latestSubmission
      ? savedSubmissionSchema.safeParse(latestSubmission.data())
      : null;
    if (!savedSubmission?.success || savedSubmission.data.participantUid !== decodedToken.uid) {
      return { ok: false, error: "Your released answer review could not be loaded. Please try again." };
    }

    return {
      ok: true,
      session,
      previousReview: gradeStudentQuizSubmission(questions, savedSubmission.data.answers, {
        ...quiz.settings,
        showCorrectAnswersAfterSubmit: true,
      }),
    };
  }

  if (attemptsRemaining === 0) {
    return { ok: false, error: `You have used all ${quiz.settings.attemptLimit} attempts for this quiz.` };
  }

  if (quiz.status !== "published") {
    return {
      ok: false,
      error: "That room is not accepting responses. Check the code or ask your lecturer to start the session.",
    };
  }

  return { ok: true, session };
}

export async function submitStudentQuiz(payload: unknown): Promise<StudentSubmissionResult> {
  const parsedSubmission = submissionSchema.safeParse(payload);
  if (!parsedSubmission.success) {
    throw new Error("The quiz submission is invalid. Please reload the session and try again.");
  }

  const storedQuiz = await findQuiz(parsedSubmission.data.roomCode);
  if (!storedQuiz || storedQuiz.quiz.status !== "published") {
    throw new Error("This quiz session is paused or closed and is no longer accepting responses.");
  }

  const { quiz, questions } = storedQuiz;
  const validQuestionIds = new Set(questions.map((question) => question.id));
  if (Object.keys(parsedSubmission.data.answers).some((id) => !validQuestionIds.has(id))) {
    throw new Error("The quiz submission contains an answer for an unknown question.");
  }

  for (const question of questions) {
    const selected = parsedSubmission.data.answers[question.id] ?? [];
    if (!["multiple", "matching", "rearrange"].includes(question.type)) {
      if (selected.length > 1) {
        throw new Error("The quiz submission contains multiple answers for a single-answer question.");
      }
    }
    if (["single", "multiple", "truefalse"].includes(question.type)
      && question.options.length
      && selected.some((answer) => !question.options.includes(answer))) {
      throw new Error("The quiz submission contains an invalid choice.");
    }
    if (question.type === "matching") {
      const selectedMatches = selected.filter(Boolean);
      if (selected.length > (question.matchItems?.length ?? 0)
        || selectedMatches.some((answer) => !question.options.includes(answer))
        || new Set(selectedMatches).size !== selectedMatches.length) {
        throw new Error("The matching response contains an invalid match.");
      }
    }
    if (question.type === "rearrange") {
      const sortedSelected = [...selected].sort();
      const sortedOptions = [...question.options].sort();
      if (selected.length !== question.options.length
        || sortedSelected.some((line, lineIndex) => line !== sortedOptions[lineIndex])) {
        throw new Error("The rearranged response must contain each code line exactly once.");
      }
    }
  }

  const decodedToken = await verifyAnonymousStudent(parsedSubmission.data.idToken);

  const firestore = getFirebaseAdminFirestore();
  const quizRef = firestore.collection("quizzes").doc(quiz.id);
  const submissionCollection = firestore.collection("quizzes").doc(quiz.id).collection("submissions");
  const submissionRef = submissionCollection.doc(parsedSubmission.data.attemptId);

  return firestore.runTransaction(async (transaction) => {
    const currentQuiz = await transaction.get(quizRef);
    const previousSubmission = await transaction.get(submissionRef);
    if (previousSubmission.exists) {
      if (previousSubmission.get("participantUid") !== decodedToken.uid) {
        throw new Error("That attempt ID is already in use. Reload the quiz and try again.");
      }
      const saved = submissionResultSchema.parse(previousSubmission.data());
      if (saved.questionResults
        || !currentQuiz.exists
        || (!quiz.settings.showCorrectAnswersAfterSubmit && currentQuiz.get("answerReviewReleased") !== true)) {
        return saved;
      }
      const savedAnswers = savedSubmissionSchema.parse(previousSubmission.data()).answers;
      return gradeStudentQuizSubmission(questions, savedAnswers, {
        ...quiz.settings,
        showCorrectAnswersAfterSubmit: true,
      });
    }
    if (!currentQuiz.exists || currentQuiz.get("status") !== "published") {
      throw new Error("This quiz session is paused or closed and is no longer accepting responses.");
    }

    const previousAttempts = await transaction.get(
      submissionCollection.where("participantUid", "==", decodedToken.uid),
    );
    if (previousAttempts.size >= quiz.settings.attemptLimit) {
      throw new Error(`You have used all ${quiz.settings.attemptLimit} attempts for this quiz.`);
    }

    const result = gradeStudentQuizSubmission(questions, parsedSubmission.data.answers, {
      ...quiz.settings,
      showCorrectAnswersAfterSubmit: quiz.settings.showCorrectAnswersAfterSubmit
        || currentQuiz.get("answerReviewReleased") === true,
    });
    const submission = {
      quizId: quiz.id,
      roomCode: parsedSubmission.data.roomCode,
      participantUid: decodedToken.uid,
      displayName: parsedSubmission.data.displayName || null,
      answers: parsedSubmission.data.answers,
      ...result,
      submittedAt: FieldValue.serverTimestamp(),
    };
    transaction.create(submissionRef, submission);
    return result;
  });
}

export async function loadStudentAnswerReview(rawPayload: unknown): Promise<StudentAnswerReviewResult> {
  const payload = answerReviewRequestSchema.safeParse(rawPayload);
  if (!payload.success) {
    return { ok: false, error: "The answer review request is invalid." };
  }

  const decodedToken = await verifyAnonymousStudent(payload.data.idToken);
  const storedQuiz = await findQuiz(payload.data.roomCode);
  if (!storedQuiz) return { ok: false, error: "That quiz could not be found." };
  const { quiz, questions } = storedQuiz;
  const reviewAvailable = quiz.settings.showCorrectAnswersAfterSubmit || quiz.answerReviewReleased;
  if (!reviewAvailable) return { ok: true, available: false };

  const submissionSnapshot = await getFirebaseAdminFirestore()
    .collection("quizzes")
    .doc(quiz.id)
    .collection("submissions")
    .doc(payload.data.attemptId)
    .get();
  if (!submissionSnapshot.exists) {
    return { ok: false, error: "That submission could not be found." };
  }

  const savedSubmission = savedSubmissionSchema.safeParse(submissionSnapshot.data());
  if (!savedSubmission.success || savedSubmission.data.participantUid !== decodedToken.uid) {
    return { ok: false, error: "That submission could not be found." };
  }

  return {
    ok: true,
    available: true,
    result: gradeStudentQuizSubmission(questions, savedSubmission.data.answers, {
      ...quiz.settings,
      showCorrectAnswersAfterSubmit: true,
    }),
  };
}
