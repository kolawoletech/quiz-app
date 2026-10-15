"use server";

import { z } from "zod";

import { gradeQuestionSubmission } from "@/lib/quiz-utils";
import { liveSessions, questionBank, quizzes } from "@/lib/mock-data";
import type { LoadStudentSessionResult, StudentQuestionResult, StudentSubmissionResult } from "@/lib/student-quiz";

const roomCodeSchema = z.string().trim().regex(/^\d{4}$/, "Enter a four-digit room code.");

const submissionSchema = z.object({
  roomCode: roomCodeSchema,
  answers: z.record(z.string(), z.array(z.string().max(5000)).max(100)),
});

function findOpenQuiz(roomCode: string) {
  const liveSession = liveSessions.find((session) => session.roomCode === roomCode);
  if (!liveSession || liveSession.status !== "Live") {
    return null;
  }

  const quiz = quizzes.find((candidate) => candidate.id === liveSession.quizId);
  if (!quiz || quiz.status !== "published") {
    return null;
  }

  const questions = quiz.questionIds.map((id) => questionBank.find((question) => question.id === id));
  if (questions.some((question) => !question)) {
    throw new Error(`The published quiz "${quiz.id}" refers to a missing question.`);
  }

  return { quiz, questions: questions.filter((question) => question !== undefined) };
}

export async function loadStudentSession(rawRoomCode: string): Promise<LoadStudentSessionResult> {
  const parsedRoomCode = roomCodeSchema.safeParse(rawRoomCode);
  if (!parsedRoomCode.success) {
    return { ok: false, error: parsedRoomCode.error.issues[0]?.message ?? "Enter a valid room code." };
  }

  const openQuiz = findOpenQuiz(parsedRoomCode.data);
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
        timeLimitMinutes: quiz.settings.timeLimitMinutes,
      },
      questions: questions.map(({ id, type, question, options, points }) => ({
        id,
        type,
        question,
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

  const openQuiz = findOpenQuiz(parsedSubmission.data.roomCode);
  if (!openQuiz) {
    throw new Error("This room is no longer accepting responses.");
  }

  const { quiz, questions } = openQuiz;
  let score = 0;
  const questionResults: StudentQuestionResult[] = questions.map((question) => {
    const result = gradeQuestionSubmission(question, parsedSubmission.data.answers[question.id] ?? []);
    score += result.score;
    return {
      questionId: question.id,
      isCorrect: result.isCorrect,
      earnedPoints: result.score,
      possiblePoints: question.points,
      ...(quiz.settings.showCorrectAnswersAfterSubmit
        ? { correctAnswer: question.answer.join(", "), explanation: question.explanation }
        : {}),
    };
  });

  const showReview = quiz.settings.showCorrectAnswersAfterSubmit;
  return {
    score: quiz.settings.showScoreAfterSubmit ? score : null,
    maxScore: quiz.settings.showScoreAfterSubmit
      ? questions.reduce((total, question) => total + question.points, 0)
      : null,
    questionResults: showReview ? questionResults : null,
  };
}
