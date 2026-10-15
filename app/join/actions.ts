"use server";

import { z } from "zod";

import { FieldValue } from "firebase-admin/firestore";

import { getFirebaseAdminAuth, getFirebaseAdminFirestore } from "@/lib/firebase-admin";
import { gradeStudentQuizSubmission } from "@/lib/quiz-utils";
import { liveSessions } from "@/lib/mock-data";
import { getPublishedQuizByRoomCode } from "@/lib/quiz-store";
import type { LoadStudentSessionResult, StudentSubmissionResult } from "@/lib/student-quiz";

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
  idToken: z.string().min(1).max(10_000),
});

async function findOpenQuiz(roomCode: string) {
  const liveSession = liveSessions.find((session) => session.roomCode === roomCode);
  if (!liveSession || liveSession.status !== "Live") {
    return null;
  }

  const storedQuiz = await getPublishedQuizByRoomCode(roomCode);
  if (!storedQuiz || storedQuiz.quiz.id !== liveSession.quizId) {
    return null;
  }

  return storedQuiz;
}

export async function loadStudentSession(rawRoomCode: string): Promise<LoadStudentSessionResult> {
  const parsedRoomCode = roomCodeSchema.safeParse(rawRoomCode);
  if (!parsedRoomCode.success) {
    return { ok: false, error: parsedRoomCode.error.issues[0]?.message ?? "Enter a valid room code." };
  }

  const openQuiz = await findOpenQuiz(parsedRoomCode.data);
  if (!openQuiz) {
    return {
      ok: false,
      error: "That room is not accepting responses. Check the code or ask your lecturer to start the session.",
    };
  }

  const { quiz, questions } = openQuiz;
  return {
    ok: true,
    session: {
      roomCode: parsedRoomCode.data,
      title: quiz.title,
      description: quiz.description,
      settings: {
        shuffleQuestions: quiz.settings.shuffleQuestions,
        shuffleOptions: quiz.settings.shuffleOptions,
        showScoreAfterSubmit: quiz.settings.showScoreAfterSubmit,
        showCorrectAnswersAfterSubmit: quiz.settings.showCorrectAnswersAfterSubmit,
        passMark: quiz.settings.passMark,
        timeLimitMinutes: quiz.settings.timeLimitMinutes,
      },
      questions: questions.map(({ id, type, question, codeSnippet, options, points }) => ({
        id,
        type,
        question,
        codeSnippet,
        options,
        points,
      })),
    },
  };
}

export async function submitStudentQuiz(payload: unknown): Promise<StudentSubmissionResult> {
  const parsedSubmission = submissionSchema.safeParse(payload);
  if (!parsedSubmission.success) {
    throw new Error("The quiz submission is invalid. Please reload the session and try again.");
  }

  const openQuiz = await findOpenQuiz(parsedSubmission.data.roomCode);
  if (!openQuiz) {
    throw new Error("This room is no longer accepting responses.");
  }

  const { quiz, questions } = openQuiz;
  const validQuestionIds = new Set(questions.map((question) => question.id));
  if (Object.keys(parsedSubmission.data.answers).some((id) => !validQuestionIds.has(id))) {
    throw new Error("The quiz submission contains an answer for an unknown question.");
  }

  for (const question of questions) {
    const selected = parsedSubmission.data.answers[question.id] ?? [];
    if (question.type !== "multiple") {
      if (selected.length > 1) {
        throw new Error("The quiz submission contains multiple answers for a single-answer question.");
      }
    }
    if (question.options.length && selected.some((answer) => !question.options.includes(answer))) {
      throw new Error("The quiz submission contains an invalid choice.");
    }
  }

  const decodedToken = await getFirebaseAdminAuth().verifyIdToken(parsedSubmission.data.idToken, true);
  if (decodedToken.firebase.sign_in_provider !== "anonymous") {
    throw new Error("Join with an anonymous student session before submitting your answers.");
  }

  const result = gradeStudentQuizSubmission(questions, parsedSubmission.data.answers, quiz.settings);
  const firestore = getFirebaseAdminFirestore();
  const submissionCollection = firestore.collection("quizzes").doc(quiz.id).collection("submissions");
  const submissionRef = quiz.settings.allowOneAttempt
    ? submissionCollection.doc(decodedToken.uid)
    : submissionCollection.doc();
  const submission = {
    quizId: quiz.id,
    roomCode: parsedSubmission.data.roomCode,
    participantUid: decodedToken.uid,
    displayName: parsedSubmission.data.displayName || null,
    answers: parsedSubmission.data.answers,
    ...result,
    submittedAt: FieldValue.serverTimestamp(),
  };

  return firestore.runTransaction(async (transaction) => {
    const previousSubmission = await transaction.get(submissionRef);
    if (previousSubmission.exists) {
      return submissionResultSchema.parse(previousSubmission.data());
    }

    transaction.create(submissionRef, submission);
    return result;
  });
}
