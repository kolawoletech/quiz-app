import { practiceQuestionBank, practiceQuizzes } from "@/lib/practice-quizzes";

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

export const questionBank: Question[] = [
  {
    id: "q1",
    type: "single",
    question: "What does ConditionalAttribute control in C#?",
    options: [
      "Class inheritance",
      "Whether calls to a method are included based on a compilation symbol",
      "Database connections",
      "Memory allocation",
    ],
    answer: ["Whether calls to a method are included based on a compilation symbol"],
    explanation: "ConditionalAttribute allows methods to be included or excluded at compile time based on symbols defined in the build.",
    points: 1,
    difficulty: "easy",
    tags: ["C#", "Attributes"],
    ownerUid: "lecturer-1",
    createdAt: "2026-10-09T09:00:00.000Z",
  },
  {
    id: "q2",
    type: "multiple",
    question: "Which of these are valid value types in C#?",
    options: ["int", "string", "bool", "decimal", "object"],
    answer: ["int", "bool", "decimal"],
    explanation: "int, bool, and decimal are value types. string and object are reference types.",
    points: 2,
    difficulty: "medium",
    tags: ["C#", "Types"],
    ownerUid: "lecturer-1",
    createdAt: "2026-10-09T10:00:00.000Z",
  },
  {
    id: "q3",
    type: "truefalse",
    question: "A static method can access instance members without creating an object.",
    options: ["True", "False"],
    answer: ["False"],
    explanation: "Static methods cannot directly access instance members because they do not belong to a specific object instance.",
    points: 1,
    difficulty: "easy",
    tags: ["OOP", "Methods"],
    ownerUid: "lecturer-1",
    createdAt: "2026-10-10T09:00:00.000Z",
  },
  {
    id: "q4",
    type: "short",
    question: "Write the keyword used to define a class that cannot be inherited.",
    options: [],
    answer: ["sealed"],
    explanation: "The sealed keyword prevents a class from being inherited.",
    points: 2,
    difficulty: "medium",
    tags: ["OOP", "Keywords"],
    ownerUid: "lecturer-1",
    createdAt: "2026-10-11T11:00:00.000Z",
  },
  {
    id: "q5",
    type: "code",
    question: "What is the output of this code snippet?\n\nint x = 3;\nConsole.WriteLine(x++);\nConsole.WriteLine(++x);",
    options: [],
    answer: ["3\n5"],
    explanation: "x++ prints the current value (3), then increments to 4. ++x increments to 5 and prints it.",
    points: 3,
    difficulty: "hard",
    tags: ["C#", "Operators"],
    ownerUid: "lecturer-1",
    createdAt: "2026-10-12T12:00:00.000Z",
  },
  ...practiceQuestionBank,
];

export const quizzes: Quiz[] = [
  {
    id: "quiz-1",
    title: "Advanced C# First Hour",
    description: "Review of Attributes and Reflection",
    status: "archived",
    questionIds: ["q1", "q2", "q3"],
    settings: {
      shuffleQuestions: true,
      shuffleOptions: true,
      allowOneAttempt: true,
      showScoreAfterSubmit: true,
      showCorrectAnswersAfterSubmit: false,
      timeLimitMinutes: 15,
      mode: "live",
    },
    updatedAt: "2026-10-12T10:00:00.000Z",
  },
  {
    id: "quiz-2",
    title: "OOP Quick Check",
    description: "Knowledge check for inheritance and encapsulation",
    status: "draft",
    questionIds: ["q3", "q4"],
    settings: {
      shuffleQuestions: false,
      shuffleOptions: false,
      allowOneAttempt: true,
      showScoreAfterSubmit: true,
      showCorrectAnswersAfterSubmit: true,
      mode: "self-paced",
    },
    updatedAt: "2026-10-13T07:30:00.000Z",
  },
  ...practiceQuizzes,
];

export const dashboardStats = [
  { label: "Total quizzes", value: "4", detail: "2 JSON practice samples" },
  { label: "Draft quizzes", value: "1", detail: "OOP Quick Check" },
  { label: "Published quizzes", value: "2", detail: "Practice assessments" },
  { label: "Active live sessions", value: "2", detail: "Rooms: 8341, 9762" },
];

export const liveSessions = [
  { roomCode: "8341", title: "Advanced C# Practice Quiz", quizId: "quiz-advanced-csharp-practice", responses: 0, status: "Live" },
  { roomCode: "9762", title: "Basic C# Practice Quiz", quizId: "quiz-basic-csharp-practice", responses: 0, status: "Live" },
];
