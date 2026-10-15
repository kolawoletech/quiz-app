import { z } from "zod";

import advancedQuizJson from "../Advanced_CSharp_Practice_Quiz.json";
import basicQuizJson from "../Basic_CSharp_Practice_Quiz.json";
import type { Question, Quiz } from "@/lib/mock-data";

const practiceQuizSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  subject: z.string().min(1),
  version: z.number().int().positive(),
  settings: z.object({
    shuffleQuestions: z.boolean(),
    shuffleOptions: z.boolean(),
    showExplanations: z.boolean(),
    passMark: z.number().min(0).max(100),
  }),
  questions: z.array(z.object({
    id: z.string().min(1),
    type: z.enum(["multiple-choice", "code-output", "code-analysis"]),
    points: z.number().int().positive(),
    question: z.string().min(1),
    options: z.array(z.object({
      id: z.string().min(1),
      text: z.string().min(1),
    })).min(2),
    answer: z.string().min(1),
    explanation: z.string().min(1),
    language: z.string().optional(),
    code: z.string().optional(),
  })).min(1),
});

const sampleQuizSources = [
  { id: "quiz-basic-csharp-practice", codePrefix: "basic", data: practiceQuizSchema.parse(basicQuizJson) },
  { id: "quiz-advanced-csharp-practice", codePrefix: "advanced", data: practiceQuizSchema.parse(advancedQuizJson) },
] as const;

export const practiceQuestionBank: Question[] = sampleQuizSources.flatMap(({ codePrefix, data }) =>
  data.questions.map((question) => {
    const correctOption = question.options.find((option) => option.id === question.answer);
    if (!correctOption) {
      throw new Error(`Practice quiz "${data.title}" question "${question.id}" has an unknown answer option.`);
    }

    return {
      id: `${codePrefix}-${question.id}`,
      type: "single",
      question: question.question,
      options: question.options.map((option) => option.text),
      answer: [correctOption.text],
      explanation: question.explanation,
      points: question.points,
      difficulty: "unrated",
      tags: [data.subject, question.type],
      ownerUid: "practice-sample",
      createdAt: "2026-10-15T00:00:00.000Z",
      ...(question.code ? { codeSnippet: question.code } : {}),
    };
  }),
);

export const practiceQuizzes: Quiz[] = sampleQuizSources.map(({ id, codePrefix, data }) => ({
  id,
  title: data.title,
  description: data.description,
  status: "published",
  questionIds: data.questions.map((question) => `${codePrefix}-${question.id}`),
  settings: {
    shuffleQuestions: data.settings.shuffleQuestions,
    shuffleOptions: data.settings.shuffleOptions,
    allowOneAttempt: false,
    showScoreAfterSubmit: true,
    showCorrectAnswersAfterSubmit: data.settings.showExplanations,
    passMark: data.settings.passMark,
    mode: "self-paced",
  },
  updatedAt: "2026-10-15T00:00:00.000Z",
}));
