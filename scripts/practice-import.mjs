import { z } from "zod";

/** @typedef {import("../lib/mock-data").Question} Question */
/** @typedef {import("../lib/mock-data").Quiz} Quiz */

const practiceQuizSchema = z.object({
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().min(1).max(1000),
  subject: z.string().trim().min(1).max(100),
  version: z.number().int().positive(),
  settings: z.object({
    shuffleQuestions: z.boolean(),
    shuffleOptions: z.boolean(),
    showExplanations: z.boolean(),
    passMark: z.number().min(0).max(100),
  }),
  questions: z.array(z.object({
    id: z.string().regex(/^[A-Za-z0-9_-]{1,100}$/),
    type: z.enum(["multiple-choice", "code-output", "code-analysis"]),
    points: z.number().int().positive(),
    question: z.string().trim().min(1).max(5000),
    options: z.array(z.object({
      id: z.string().regex(/^[A-Za-z0-9_-]{1,40}$/),
      text: z.string().trim().min(1).max(1000),
    })).min(2).max(20),
    answer: z.string().min(1),
    explanation: z.string().min(1),
    language: z.string().optional(),
    code: z.string().optional(),
  })).min(1).max(100),
}).superRefine((quiz, context) => {
  const questionIds = quiz.questions.map((question) => question.id);
  if (new Set(questionIds).size !== questionIds.length) {
    context.addIssue({ code: "custom", message: "Question IDs must be unique." });
  }

  quiz.questions.forEach((question, questionIndex) => {
    const optionIds = question.options.map((option) => option.id);
    const optionTexts = question.options.map((option) => option.text);
    if (new Set(optionIds).size !== optionIds.length || new Set(optionTexts).size !== optionTexts.length) {
      context.addIssue({
        code: "custom",
        message: "Each question must have unique option IDs and option text.",
        path: ["questions", questionIndex, "options"],
      });
    }
  });
});

const importedQuestionSchema = z.object({
  id: z.string().regex(/^[A-Za-z0-9_-]{1,100}$/),
  type: z.enum(["single", "multiple", "truefalse", "matching", "rearrange", "short", "code"]),
  question: z.string().trim().min(1).max(5000),
  options: z.array(z.string().min(1).max(1000)).max(100).default([]),
  matchItems: z.array(z.string().min(1).max(1000)).max(20).optional(),
  answer: z.array(z.string().min(1).max(1000)).min(1).max(100),
  explanation: z.string().max(5000).default(""),
  points: z.number().int().positive().max(100),
  difficulty: z.enum(["easy", "medium", "hard", "unrated"]).default("unrated"),
  tags: z.array(z.string().trim().min(1).max(40)).max(20).default([]),
  codeSnippet: z.string().max(10_000).optional(),
}).superRefine((question, context) => {
  const addIssue = (message, field) => context.addIssue({
    code: "custom",
    message,
    path: [field],
  });

  if (question.type === "single" || question.type === "multiple") {
    if (question.options.length < 2 || question.options.length > 20) {
      addIssue("Choice questions need 2–20 options.", "options");
    }
    if (new Set(question.options).size !== question.options.length) {
      addIssue("Question options must be unique.", "options");
    }
    if (question.answer.some((answer) => !question.options.includes(answer))) {
      addIssue("Every correct answer must match an option.", "answer");
    }
    if (question.type === "single" && question.answer.length !== 1) {
      addIssue("Single-choice questions need exactly one correct answer.", "answer");
    }
    if (question.type === "multiple" && new Set(question.answer).size !== question.answer.length) {
      addIssue("Correct answers must be unique.", "answer");
    }
  }

  if (question.type === "truefalse") {
    if (question.options.length !== 2 || !question.options.includes("True") || !question.options.includes("False")) {
      addIssue('True/false questions must use options "True" and "False".', "options");
    }
    if (question.answer.length !== 1 || !["True", "False"].includes(question.answer[0])) {
      addIssue('True/false questions must have one answer: "True" or "False".', "answer");
    }
  }

  if (question.type === "matching") {
    const matchItems = question.matchItems ?? [];
    if (matchItems.length < 2 || matchItems.length > 20 || new Set(matchItems).size !== matchItems.length) {
      addIssue("Matching questions need 2–20 unique matchItems.", "matchItems");
    }
    if (question.options.length < 2 || question.options.length > 20 || new Set(question.options).size !== question.options.length) {
      addIssue("Matching questions need 2–20 unique options.", "options");
    }
    if (question.answer.length !== matchItems.length
      || new Set(question.answer).size !== question.answer.length
      || question.answer.some((answer) => !question.options.includes(answer))) {
      addIssue("Provide one unique valid option in answer for each matchItem.", "answer");
    }
  }

  if (question.type === "rearrange") {
    const options = [...question.options].sort();
    const answer = [...question.answer].sort();
    if (question.options.length < 2 || question.answer.length !== question.options.length
      || options.some((line, index) => line !== answer[index])) {
      addIssue("Rearrange questions need at least two options, with answer listing those same items in the correct order.", "answer");
    }
  }

  if (question.type === "short" || question.type === "code") {
    if (question.options.length !== 0 || question.answer.length !== 1) {
      addIssue("Short and code questions need no options and exactly one correct answer.", "answer");
    }
  }
});

const importedQuizSchema = z.object({
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().max(1000).default(""),
  subject: z.string().trim().max(100).default(""),
  settings: z.object({
    shuffleQuestions: z.boolean().default(false),
    shuffleOptions: z.boolean().default(false),
    showScoreAfterSubmit: z.boolean().default(true),
    showCorrectAnswersAfterSubmit: z.boolean().default(false),
    passMark: z.number().min(0).max(100).optional(),
    timeLimitMinutes: z.number().int().min(1).max(600).optional(),
    attemptLimit: z.number().int().min(1).max(10).default(3),
    mode: z.enum(["self-paced", "live"]).default("self-paced"),
  }).default({}),
  questions: z.array(importedQuestionSchema).min(1).max(100),
}).superRefine((quiz, context) => {
  const ids = quiz.questions.map((question) => question.id);
  if (new Set(ids).size !== ids.length) {
    context.addIssue({ code: "custom", message: "Question IDs must be unique.", path: ["questions"] });
  }
});

/**
 * @param {unknown} rawData
 * @param {{ codePrefix: string, roomCode: string }} options
 * @returns {{ quiz: Omit<Quiz, "id">, questions: (Question & { order: number })[] }}
 */
export function mapPracticeQuiz(rawData, { codePrefix, roomCode }) {
  const legacyResult = practiceQuizSchema.safeParse(rawData);
  if (
    !legacyResult.success
    && typeof rawData === "object"
    && rawData !== null
    && "questions" in rawData
    && Array.isArray(rawData.questions)
    && rawData.questions.some((question) =>
      typeof question === "object"
      && question !== null
      && "options" in question
      && Array.isArray(question.options)
      && question.options.some((option) => typeof option === "object" && option !== null),
    )
  ) {
    practiceQuizSchema.parse(rawData);
  }

  if (legacyResult.success) {
    const data = legacyResult.data;
    const questions = data.questions.map(/** @returns {Question & { order: number }} */ (question, order) => {
      const correctOption = question.options.find((option) => option.id === question.answer);
      if (!correctOption) {
        throw new Error(`Quiz "${data.title}" question "${question.id}" has an unknown answer option.`);
      }

      return {
        id: `${codePrefix}-${question.id}`,
        order,
        type: "single",
        question: question.question,
        ...(question.code ? { codeSnippet: question.code } : {}),
        options: question.options.map((option) => option.text),
        answer: [correctOption.text],
        explanation: question.explanation,
        points: question.points,
        difficulty: "unrated",
        tags: [data.subject, question.type],
        ownerUid: "practice-sample",
        createdAt: "2026-10-15T00:00:00.000Z",
      };
    });

    return {
      quiz: {
        title: data.title,
        description: data.description,
        status: "published",
        roomCode,
        questionIds: questions.map((question) => question.id),
        settings: {
          shuffleQuestions: data.settings.shuffleQuestions,
          shuffleOptions: data.settings.shuffleOptions,
          attemptLimit: 3,
          showScoreAfterSubmit: true,
          showCorrectAnswersAfterSubmit: data.settings.showExplanations,
          passMark: data.settings.passMark,
          mode: "self-paced",
        },
        updatedAt: new Date().toISOString(),
      },
      questions,
    };
  }

  const data = importedQuizSchema.parse(rawData);
  const questions = data.questions.map(/** @returns {Question & { order: number }} */ (question, order) => ({
    id: `${codePrefix}-${question.id}`,
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
    tags: [...(data.subject ? [data.subject] : []), ...question.tags],
    ownerUid: "practice-sample",
    createdAt: new Date().toISOString(),
  }));

  return {
    quiz: {
      title: data.title,
      description: data.description,
      status: "draft",
      roomCode,
      questionIds: questions.map((question) => question.id),
      settings: {
        shuffleQuestions: data.settings.shuffleQuestions,
        shuffleOptions: data.settings.shuffleOptions,
        attemptLimit: data.settings.attemptLimit,
        showScoreAfterSubmit: data.settings.showScoreAfterSubmit,
        showCorrectAnswersAfterSubmit: data.settings.showCorrectAnswersAfterSubmit,
        ...(data.settings.passMark !== undefined ? { passMark: data.settings.passMark } : {}),
        ...(data.settings.timeLimitMinutes !== undefined ? { timeLimitMinutes: data.settings.timeLimitMinutes } : {}),
        mode: data.settings.mode,
      },
      updatedAt: new Date().toISOString(),
    },
    questions,
  };
}
