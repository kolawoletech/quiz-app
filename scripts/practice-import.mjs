import { z } from "zod";

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

export function mapPracticeQuiz(rawData, { codePrefix, roomCode }) {
  const data = practiceQuizSchema.parse(rawData);
  const questions = data.questions.map((question, order) => {
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
        allowOneAttempt: false,
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
