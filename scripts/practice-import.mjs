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

/**
 * @param {unknown} rawData
 * @param {{ codePrefix: string, roomCode: string }} options
 * @returns {{ quiz: Omit<Quiz, "id">, questions: (Question & { order: number })[] }}
 */
export function mapPracticeQuiz(rawData, { codePrefix, roomCode }) {
  const data = practiceQuizSchema.parse(rawData);
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
