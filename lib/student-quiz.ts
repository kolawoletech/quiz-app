import type { QuestionType } from "@/lib/mock-data";

export interface StudentQuestion {
  id: string;
  type: QuestionType;
  question: string;
  codeSnippet?: string;
  options: string[];
  points: number;
}

export interface StudentSession {
  roomCode: string;
  title: string;
  description: string;
  settings: {
    shuffleQuestions: boolean;
    shuffleOptions: boolean;
    showScoreAfterSubmit: boolean;
    showCorrectAnswersAfterSubmit: boolean;
    passMark?: number;
    timeLimitMinutes?: number;
  };
  questions: StudentQuestion[];
}

export type LoadStudentSessionResult =
  | { ok: true; session: StudentSession }
  | { ok: false; error: string };

export interface StudentQuestionResult {
  questionId: string;
  isCorrect: boolean;
  earnedPoints: number;
  possiblePoints: number;
  correctAnswer?: string;
  explanation?: string;
}

export interface StudentSubmissionResult {
  score: number | null;
  maxScore: number | null;
  questionResults: StudentQuestionResult[] | null;
}
