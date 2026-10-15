import { z } from "zod";

export const optionSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(1),
});

export const questionSchema = z.object({
  id: z.string().min(1),
  type: z.enum(["single", "multiple", "truefalse", "short", "code"]),
  question: z.string().min(1),
  options: z.array(optionSchema).default([]),
  answer: z.array(z.string()).min(1),
  explanation: z.string().default(""),
  points: z.number().int().positive().default(1),
  difficulty: z.enum(["easy", "medium", "hard", "unrated"]).default("easy"),
  tags: z.array(z.string()).default([]),
  codeSnippet: z.string().optional(),
});

export const quizSettingsSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional().default(""),
  shuffleQuestions: z.boolean().default(false),
  shuffleOptions: z.boolean().default(false),
  allowOneAttempt: z.boolean().default(true),
  showScoreAfterSubmit: z.boolean().default(true),
  showCorrectAnswersAfterSubmit: z.boolean().default(false),
  defaultPoints: z.number().int().positive().default(1),
  mode: z.enum(["self-paced", "live"]).default("self-paced"),
  timeLimitMinutes: z.number().int().nonnegative().optional(),
});

export const importPayloadSchema = z.object({
  quiz: z.object({
    title: z.string().min(1),
    description: z.string().optional().default(""),
    settings: quizSettingsSchema,
    questions: z.array(questionSchema).min(1),
  }),
});

export type QuestionImport = z.infer<typeof questionSchema>;
export type QuizImport = z.infer<typeof importPayloadSchema>;
