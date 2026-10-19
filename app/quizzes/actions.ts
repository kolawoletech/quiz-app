"use server";

import { randomUUID } from "node:crypto";
import { z } from "zod";

import { getFirebaseAdminFirestore } from "@/lib/firebase-admin";
import { verifyLecturerIdToken } from "@/lib/lecturer-auth";
import { generateRoomCode } from "@/lib/quiz-utils";
import { getLecturerQuizzes, parseQuiz } from "@/lib/quiz-store";
import type { Question, Quiz } from "@/lib/mock-data";
import { mapPracticeQuiz } from "@/scripts/practice-import.mjs";

const questionInputSchema = z.object({
  id: z.string().regex(/^[A-Za-z0-9_-]{1,128}$/).optional(),
  type: z.enum(["single", "multiple", "truefalse", "matching", "rearrange", "short", "code"]),
  question: z.string().trim().min(1).max(5000),
  codeSnippet: z.string().max(10_000).optional(),
  options: z.array(z.string().min(1).max(1000).refine((value) => value.trim().length > 0)).max(100),
  matchItems: z.array(z.string().min(1).max(1000).refine((value) => value.trim().length > 0)).max(20).optional(),
  answer: z.array(z.string().min(1).max(1000).refine((value) => value.trim().length > 0)).min(1).max(100),
  explanation: z.string().max(5000),
  points: z.number().int().min(1).max(100),
  difficulty: z.enum(["easy", "medium", "hard", "unrated"]),
  tags: z.array(z.string().trim().min(1).max(40)).max(20),
});

const quizDraftSchema = z.object({
  idToken: z.string().min(1).max(10_000),
  quizId: z.string().regex(/^[A-Za-z0-9_-]{1,128}$/).optional(),
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().max(1000),
  attemptLimit: z.number().int().min(1).max(10),
  passMark: z.number().min(0).max(100).optional(),
  timeLimitMinutes: z.number().int().min(1).max(600).optional(),
  shuffleQuestions: z.boolean(),
  shuffleOptions: z.boolean(),
  showScoreAfterSubmit: z.boolean(),
  showCorrectAnswersAfterSubmit: z.boolean(),
  mode: z.enum(["self-paced", "live"]),
  questions: z.array(questionInputSchema).min(1).max(100),
}).superRefine((value, context) => {
  const ids = value.questions.map((question) => question.id).filter(Boolean);
  if (new Set(ids).size !== ids.length) {
    context.addIssue({ code: "custom", message: "Question IDs must be unique.", path: ["questions"] });
  }

  value.questions.forEach((question, index) => {
    if (question.type !== "rearrange" && new Set(question.options).size !== question.options.length) {
      context.addIssue({ code: "custom", message: "Question options must be unique.", path: ["questions", index, "options"] });
    }
    if (!["rearrange"].includes(question.type) && new Set(question.answer).size !== question.answer.length) {
      context.addIssue({ code: "custom", message: "Correct answers must be unique.", path: ["questions", index, "answer"] });
    }
    if (["single", "multiple"].includes(question.type) && (question.options.length < 2 || question.options.length > 20)) {
      context.addIssue({ code: "custom", message: "Choice questions need at least two options.", path: ["questions", index, "options"] });
    }
    if (question.type === "truefalse" && (
      question.options.length !== 2
      || !question.options.includes("True")
      || !question.options.includes("False")
    )) {
      context.addIssue({ code: "custom", message: "True/false questions must use True and False options.", path: ["questions", index, "options"] });
    }
    if (!["multiple", "matching", "rearrange"].includes(question.type) && question.answer.length !== 1) {
      context.addIssue({ code: "custom", message: "Only multiple-select, matching, and rearrange questions can have multiple answers.", path: ["questions", index, "answer"] });
    }
    if (["single", "multiple", "truefalse"].includes(question.type) && question.options.length && question.answer.some((answer) => !question.options.includes(answer))) {
      context.addIssue({ code: "custom", message: "Every correct answer must exactly match one of the options.", path: ["questions", index, "answer"] });
    }
    if (question.type === "matching") {
      const matchItems = question.matchItems ?? [];
      if (matchItems.length < 2 || matchItems.length > 20 || new Set(matchItems).size !== matchItems.length) {
        context.addIssue({ code: "custom", message: "Matching questions need 2–20 unique items in the left column.", path: ["questions", index, "matchItems"] });
      }
      if (question.options.length < 2 || question.options.length > 20) {
        context.addIssue({ code: "custom", message: "Matching questions need 2–20 options in the right column.", path: ["questions", index, "options"] });
      }
      if (question.answer.length !== matchItems.length || question.answer.some((answer) => !question.options.includes(answer))) {
        context.addIssue({ code: "custom", message: "Provide one valid right-column match for each left-column item.", path: ["questions", index, "answer"] });
      }
    }
    if (question.type === "rearrange") {
      const options = [...question.options].sort();
      const answers = [...question.answer].sort();
      if (question.options.length < 2) {
        context.addIssue({ code: "custom", message: "Rearrange questions need at least two code lines.", path: ["questions", index, "options"] });
      }
      if (question.answer.length !== question.options.length
        || options.some((line, lineIndex) => line !== answers[lineIndex])) {
        context.addIssue({ code: "custom", message: "The correct order must contain the same items as the listed options.", path: ["questions", index, "answer"] });
      }
    }
  });
});

const transitionSchema = z.object({
  idToken: z.string().min(1).max(10_000),
  quizId: z.string().min(1),
  action: z.enum(["publish", "pause", "resume", "close"]),
});

type LecturerQuiz = Awaited<ReturnType<typeof getLecturerQuizzes>>[number];

export type QuizActionResponse<T = undefined> =
  | { ok: true; email: string; data: T }
  | { ok: false; error: string };

function toLecturerQuiz(quiz: Quiz, questions: Question[]): LecturerQuiz {
  return { quiz, questions };
}

async function authorized(idToken: unknown) {
  return verifyLecturerIdToken(idToken);
}

async function generateUniqueRoomCode(excludedQuizId?: string) {
  const quizzes = getFirebaseAdminFirestore().collection("quizzes");
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const roomCode = generateRoomCode();
    const matches = await quizzes.where("roomCode", "==", roomCode).get();
    if (!matches.docs.some((document) => document.id !== excludedQuizId)) return roomCode;
  }
  throw new Error("A unique room code could not be generated. Try again.");
}

export async function loadLecturerQuizzes(rawIdToken: unknown): Promise<QuizActionResponse<LecturerQuiz[]>> {
  const authorization = await authorized(rawIdToken);
  if (!authorization.ok) return authorization;

  return {
    ok: true,
    email: authorization.email,
    data: await getLecturerQuizzes(),
  };
}

export async function saveQuizDraft(rawPayload: unknown): Promise<QuizActionResponse<LecturerQuiz>> {
  const payload = quizDraftSchema.safeParse(rawPayload);
  if (!payload.success) {
    return { ok: false, error: payload.error.issues[0]?.message ?? "Check the quiz details and try again." };
  }

  const authorization = await authorized(payload.data.idToken);
  if (!authorization.ok) return authorization;

  const firestore = getFirebaseAdminFirestore();
  const quizId = payload.data.quizId ?? randomUUID();
  const quizRef = firestore.collection("quizzes").doc(quizId);
  const newRoomCode = payload.data.quizId ? null : await generateUniqueRoomCode();
  return firestore.runTransaction(async (transaction) => {
    const existingSnapshot = await transaction.get(quizRef);
    if (payload.data.quizId && !existingSnapshot.exists) {
      return { ok: false, error: "That quiz no longer exists." };
    }
    if (!payload.data.quizId && existingSnapshot.exists) {
      return { ok: false, error: "The quiz could not be created. Please try again." };
    }

    const existingQuiz = existingSnapshot.exists
      ? parseQuiz(existingSnapshot.id, existingSnapshot.data())
      : null;
    if (existingQuiz && existingQuiz.status !== "draft") {
      return { ok: false, error: "Only draft quizzes can be edited. Published quizzes are locked to preserve submitted results." };
    }

    const questionCollection = quizRef.collection("questions");
    const existingQuestions = existingSnapshot.exists
      ? await transaction.get(questionCollection)
      : null;
    if (existingSnapshot.exists) {
      const submissions = await transaction.get(quizRef.collection("submissions").limit(1));
      if (!submissions.empty) {
        return { ok: false, error: "This quiz has submissions and cannot be edited without changing historical results." };
      }
    } else if (newRoomCode) {
      const roomCodeMatches = await transaction.get(
        firestore.collection("quizzes").where("roomCode", "==", newRoomCode),
      );
      if (!roomCodeMatches.empty) {
        return { ok: false, error: "The generated room code is already in use. Try saving again." };
      }
    }
    const roomCode = existingQuiz?.roomCode ?? newRoomCode;
    if (!roomCode) {
      return { ok: false, error: "A room code could not be generated. Please try saving again." };
    }

    const questions = payload.data.questions.map((question, order): Question & { order: number } => ({
      id: question.id ?? randomUUID(),
      order,
      type: question.type,
      question: question.question,
      ...(question.codeSnippet ? { codeSnippet: question.codeSnippet } : {}),
      options: question.options,
      ...(question.matchItems ? { matchItems: question.matchItems } : {}),
      answer: question.answer,
      explanation: question.explanation,
      points: question.points,
      difficulty: question.difficulty,
      tags: question.tags,
      ownerUid: authorization.email,
      createdAt: existingQuestions?.docs.find((document) => document.id === question.id)?.get("createdAt") ?? new Date().toISOString(),
    }));

    const quiz: Quiz = {
      id: quizId,
      title: payload.data.title,
      description: payload.data.description,
      status: "draft",
      roomCode,
      questionIds: questions.map((question) => question.id),
      settings: {
        shuffleQuestions: payload.data.shuffleQuestions,
        shuffleOptions: payload.data.shuffleOptions,
        attemptLimit: payload.data.attemptLimit,
        showScoreAfterSubmit: payload.data.showScoreAfterSubmit,
        showCorrectAnswersAfterSubmit: payload.data.showCorrectAnswersAfterSubmit,
        ...(payload.data.passMark !== undefined ? { passMark: payload.data.passMark } : {}),
        ...(payload.data.timeLimitMinutes !== undefined ? { timeLimitMinutes: payload.data.timeLimitMinutes } : {}),
        mode: payload.data.mode,
      },
      updatedAt: new Date().toISOString(),
    };

    if (existingQuestions) {
      existingQuestions.docs.forEach((document) => {
        if (!quiz.questionIds.includes(document.id)) transaction.delete(document.ref);
      });
    }
    transaction.set(quizRef, quiz);
    questions.forEach(({ id, ...question }) => transaction.set(questionCollection.doc(id), question));
    return { ok: true, email: authorization.email, data: toLecturerQuiz(quiz, questions) };
  });
}

export async function importQuizJson(rawIdToken: unknown, rawJson: unknown): Promise<QuizActionResponse<LecturerQuiz>> {
  const authorization = await authorized(rawIdToken);
  if (!authorization.ok) return authorization;

  const jsonText = z.string().min(1).max(1_000_000).safeParse(rawJson);
  if (!jsonText.success) {
    return { ok: false, error: "Choose a JSON file smaller than 1 MB." };
  }

  let data: unknown;
  try {
    data = JSON.parse(jsonText.data);
  } catch {
    return { ok: false, error: "The selected file is not valid JSON." };
  }

  const firestore = getFirebaseAdminFirestore();
  const quizId = randomUUID();
  const codePrefix = quizId.replaceAll("-", "").slice(0, 8);
  const roomCode = await generateUniqueRoomCode();
  let imported: ReturnType<typeof mapPracticeQuiz>;
  try {
    imported = mapPracticeQuiz(data, {
      codePrefix,
      roomCode,
    });
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error
        ? `Could not import this quiz: ${error.message}`
        : "Could not import this quiz. Check the JSON format.",
    };
  }

  const quizRef = firestore.collection("quizzes").doc(quizId);
  const quiz: Quiz = {
    ...imported.quiz,
    id: quizId,
    status: "draft",
    settings: {
      ...imported.quiz.settings,
      attemptLimit: imported.quiz.settings.attemptLimit,
    },
  };
  const questions = imported.questions.map((question) => ({
    ...question,
    ownerUid: authorization.email,
  }));

  const committed = await firestore.runTransaction(async (transaction) => {
    const roomCodeMatches = await transaction.get(
      firestore.collection("quizzes").where("roomCode", "==", roomCode),
    );
    if (!roomCodeMatches.empty) return false;

    transaction.set(quizRef, quiz);
    questions.forEach(({ id, ...question }) => {
      transaction.set(quizRef.collection("questions").doc(id), question);
    });
    return true;
  });
  if (!committed) {
    return { ok: false, error: "The generated room code was just taken. Please import the file again." };
  }

  return { ok: true, email: authorization.email, data: toLecturerQuiz(quiz, questions) };
}

export async function transitionQuiz(rawPayload: unknown): Promise<QuizActionResponse<Quiz>> {
  const payload = transitionSchema.safeParse(rawPayload);
  if (!payload.success) {
    return { ok: false, error: "The quiz action is invalid." };
  }

  const authorization = await authorized(payload.data.idToken);
  if (!authorization.ok) return authorization;

  const firestore = getFirebaseAdminFirestore();
  const quizRef = firestore.collection("quizzes").doc(payload.data.quizId);
  return firestore.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(quizRef);
    if (!snapshot.exists) return { ok: false, error: "That quiz no longer exists." };
    const quiz = parseQuiz(snapshot.id, snapshot.data());
    const nextStatuses: Record<typeof payload.data.action, Quiz["status"] | null> = {
      publish: quiz.status === "draft" ? "published" : null,
      pause: quiz.status === "published" ? "paused" : null,
      resume: quiz.status === "paused" ? "published" : null,
      close: quiz.status === "published" || quiz.status === "paused" ? "closed" : null,
    };
    const nextStatus = nextStatuses[payload.data.action];
    if (!nextStatus) {
      return { ok: false, error: `Cannot ${payload.data.action} a quiz while it is ${quiz.status}.` };
    }

    if (payload.data.action === "publish") {
      const questions = await transaction.get(quizRef.collection("questions"));
      if (questions.size === 0) return { ok: false, error: "Add at least one question before publishing." };
      const duplicateRoom = await transaction.get(
        firestore.collection("quizzes").where("roomCode", "==", quiz.roomCode),
      );
      if (duplicateRoom.docs.some((document) => document.id !== quiz.id)) {
        return { ok: false, error: "Another quiz already uses this room code. Edit the draft to resolve the conflict." };
      }
    }

    const updatedAt = new Date().toISOString();
    transaction.update(quizRef, { status: nextStatus, updatedAt });
    return { ok: true, email: authorization.email, data: { ...quiz, status: nextStatus, updatedAt } };
  });
}
