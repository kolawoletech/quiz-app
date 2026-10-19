export type QuestionType = "single" | "multiple" | "truefalse" | "matching" | "rearrange" | "short" | "code";

export interface Question {
  id: string;
  type: QuestionType;
  question: string;
  codeSnippet?: string;
  options: string[];
  matchItems?: string[];
  answer: string[];
  explanation: string;
  points: number;
  difficulty: "easy" | "medium" | "hard" | "unrated";
  tags: string[];
  ownerUid: string;
  createdAt: string;
}

export interface Quiz {
  id: string;
  title: string;
  description: string;
  status: "draft" | "published" | "paused" | "closed";
  roomCode: string;
  questionIds: string[];
  settings: {
    shuffleQuestions: boolean;
    shuffleOptions: boolean;
    attemptLimit: number;
    showScoreAfterSubmit: boolean;
    showCorrectAnswersAfterSubmit: boolean;
    passMark?: number;
    timeLimitMinutes?: number;
    mode: "self-paced" | "live";
  };
  updatedAt: string;
}
