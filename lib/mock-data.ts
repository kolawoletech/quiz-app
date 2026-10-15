export type QuestionType = "single" | "multiple" | "truefalse" | "short" | "code";

export interface Question {
  id: string;
  type: QuestionType;
  question: string;
  codeSnippet?: string;
  options: string[];
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
  status: "draft" | "published" | "archived";
  roomCode: string;
  questionIds: string[];
  settings: {
    shuffleQuestions: boolean;
    shuffleOptions: boolean;
    allowOneAttempt: boolean;
    showScoreAfterSubmit: boolean;
    showCorrectAnswersAfterSubmit: boolean;
    passMark?: number;
    timeLimitMinutes?: number;
    mode: "self-paced" | "live";
  };
  updatedAt: string;
}

export interface QuizSummary {
  id: string;
  title: string;
  description: string;
  status: "draft" | "published" | "archived";
  questionCount: number;
  roomCode: string;
  settings: Pick<Quiz["settings"], "allowOneAttempt" | "passMark" | "timeLimitMinutes" | "mode">;
}

export const quizSummaries: QuizSummary[] = [
  {
    id: "quiz-advanced-csharp-practice",
    title: "Advanced C# Practice Quiz",
    description: "Advanced C# practice covering the supplied sample topics.",
    status: "published",
    questionCount: 30,
    roomCode: "8341",
    settings: { allowOneAttempt: false, passMark: 50, mode: "self-paced" },
  },
  {
    id: "quiz-basic-csharp-practice",
    title: "Basic C# Practice Quiz",
    description: "Basic C# practice covering the supplied sample topics.",
    status: "published",
    questionCount: 22,
    roomCode: "9762",
    settings: { allowOneAttempt: false, passMark: 50, mode: "self-paced" },
  },
];

export const dashboardStats = [
  { label: "Total quizzes", value: "2", detail: "Practice samples" },
  { label: "Draft quizzes", value: "0", detail: "No drafts" },
  { label: "Published quizzes", value: "2", detail: "Practice assessments" },
  { label: "Active live sessions", value: "2", detail: "Rooms: 8341, 9762" },
];

export const liveSessions = [
  { roomCode: "8341", title: "Advanced C# Practice Quiz", quizId: "quiz-advanced-csharp-practice", responses: 0, status: "Live" },
  { roomCode: "9762", title: "Basic C# Practice Quiz", quizId: "quiz-basic-csharp-practice", responses: 0, status: "Live" },
];
