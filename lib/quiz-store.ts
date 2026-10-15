import "server-only";

import { z } from "zod";

import { getFirebaseAdminFirestore } from "@/lib/firebase-admin";
import type { Question, Quiz } from "@/lib/mock-data";

const quizSchema = z.object({
  title: z.string().min(1),
  description: z.string(),
  status: z.enum(["draft", "published", "paused", "closed", "archived"]),
  roomCode: z.string().regex(/^\d{4}$/),
  questionIds: z.array(z.string().min(1)).min(1),
  settings: z.object({
    shuffleQuestions: z.boolean(),
    shuffleOptions: z.boolean(),
    attemptLimit: z.number().int().min(1).max(10).optional(),
    allowOneAttempt: z.boolean().optional(),
    showScoreAfterSubmit: z.boolean(),
    showCorrectAnswersAfterSubmit: z.boolean(),
    passMark: z.number().min(0).max(100).optional(),
    timeLimitMinutes: z.number().int().positive().optional(),
    mode: z.enum(["self-paced", "live"]),
  }),
  updatedAt: z.string(),
});

const questionSchema = z.object({
  type: z.enum(["single", "multiple", "truefalse", "short", "code"]),
  question: z.string().min(1),
  codeSnippet: z.string().optional(),
  options: z.array(z.string()),
  answer: z.array(z.string()),
  explanation: z.string(),
  points: z.number().positive(),
  difficulty: z.enum(["easy", "medium", "hard", "unrated"]),
  tags: z.array(z.string()),
  ownerUid: z.string(),
  createdAt: z.string(),
  order: z.number().int().nonnegative(),
});

async function loadQuizQuestions(quizId: string, questionIds: string[]): Promise<Question[]> {
  const collection = getFirebaseAdminFirestore()
    .collection("quizzes")
    .doc(quizId)
    .collection("questions");
  const snapshots = await Promise.all(questionIds.map((id) => collection.doc(id).get()));

  return snapshots.map((snapshot, index) => {
    if (!snapshot.exists) {
      throw new Error(`Quiz "${quizId}" refers to missing question "${questionIds[index]}".`);
    }

    const parsed = questionSchema.safeParse(snapshot.data());
    if (!parsed.success) {
      throw new Error(`Question "${snapshot.id}" in quiz "${quizId}" has an invalid format.`);
    }

    return { id: snapshot.id, ...parsed.data };
  });
}

export function parseQuiz(id: string, data: unknown): Quiz {
  const parsed = quizSchema.safeParse(data);
  if (!parsed.success) {
    throw new Error(`Quiz "${id}" has an invalid format.`);
  }
  const { allowOneAttempt, attemptLimit, ...settings } = parsed.data.settings;
  return {
    id,
    ...parsed.data,
    status: parsed.data.status === "archived" ? "closed" : parsed.data.status,
    settings: {
      ...settings,
      attemptLimit: attemptLimit ?? (allowOneAttempt === false ? 10 : 1),
    },
  };
}

export async function getQuizByRoomCode(roomCode: string) {
  const snapshot = await getFirebaseAdminFirestore()
    .collection("quizzes")
    .where("roomCode", "==", roomCode)
    .limit(1)
    .get();
  const document = snapshot.docs[0];
  if (!document) return null;

  const quiz = parseQuiz(document.id, document.data());
  return { quiz, questions: await loadQuizQuestions(quiz.id, quiz.questionIds) };
}

export async function getPublishedQuizzesWithQuestions() {
  const snapshot = await getFirebaseAdminFirestore().collection("quizzes").get();
  const published = snapshot.docs
    .filter((document) => document.get("status") === "published" || document.get("status") === "paused" || document.get("status") === "closed")
    .map((document) => parseQuiz(document.id, document.data()));

  return Promise.all(published.map(async (quiz) => ({
    quiz,
    questions: await loadQuizQuestions(quiz.id, quiz.questionIds),
  })));
}

export async function getLecturerQuestionBank() {
  const snapshot = await getFirebaseAdminFirestore().collection("quizzes").get();
  const quizzes = snapshot.docs.map((document) => parseQuiz(document.id, document.data()));
  const questionSets = await Promise.all(quizzes.map((quiz) => loadQuizQuestions(quiz.id, quiz.questionIds)));
  return questionSets.flat();
}

export async function getLecturerQuizzes() {
  const snapshot = await getFirebaseAdminFirestore().collection("quizzes").get();
  const quizzes = snapshot.docs.map((document) => parseQuiz(document.id, document.data()));

  return Promise.all(quizzes.map(async (quiz) => ({
    quiz,
    questions: await loadQuizQuestions(quiz.id, quiz.questionIds),
  })));
}
