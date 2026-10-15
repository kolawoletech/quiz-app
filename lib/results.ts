import type { Question, Quiz } from "@/lib/mock-data";
import { buildCsv, gradeQuestionSubmission } from "@/lib/quiz-utils";

export interface StoredQuizSubmission {
  id: string;
  displayName: string | null;
  answers: Record<string, string[]>;
  score: number | null;
  maxScore: number | null;
  submittedAt: string | null;
}

export interface SubmissionQuestionResult {
  id: string;
  question: string;
  selectedAnswers: string[];
  isCorrect: boolean;
  earnedPoints: number;
  possiblePoints: number;
}

export interface QuizSubmissionResult extends StoredQuizSubmission {
  percent: number | null;
  passed: boolean | null;
  questions: SubmissionQuestionResult[];
}

export interface QuizResults {
  id: string;
  title: string;
  description: string;
  roomCode: string | null;
  passMark: number | null;
  submissionCount: number;
  gradedCount: number;
  averagePercent: number | null;
  passCount: number;
  questionStats: Array<{
    id: string;
    question: string;
    correctCount: number;
    responseCount: number;
    percentCorrect: number | null;
  }>;
  submissions: QuizSubmissionResult[];
}

export function buildQuizResults(
  quiz: Quiz,
  submissions: StoredQuizSubmission[],
  questions: Question[],
  roomCode: string | null = null,
): QuizResults {
  const quizQuestions = quiz.questionIds.map((questionId) => {
    const question = questions.find((candidate) => candidate.id === questionId);
    if (!question) {
      throw new Error(`Quiz "${quiz.id}" refers to missing question "${questionId}".`);
    }
    return question;
  });

  const submissionsWithResults = submissions.map((submission): QuizSubmissionResult => {
    const questionResults = quizQuestions.map((question): SubmissionQuestionResult => {
      const selectedAnswers = submission.answers[question.id] ?? [];
      const grade = gradeQuestionSubmission(question, selectedAnswers);
      return {
        id: question.id,
        question: question.question,
        selectedAnswers,
        isCorrect: grade.isCorrect,
        earnedPoints: grade.score,
        possiblePoints: question.points,
      };
    });
    const computedMaxScore = quizQuestions.reduce((total, question) => total + question.points, 0);
    const maxScore = submission.maxScore ?? computedMaxScore;
    const score = submission.score ?? questionResults.reduce((total, result) => total + result.earnedPoints, 0);
    const percent = maxScore > 0 ? (score / maxScore) * 100 : null;

    return {
      ...submission,
      score,
      maxScore,
      percent,
      passed: percent === null || quiz.settings.passMark === undefined
        ? null
        : percent >= quiz.settings.passMark,
      questions: questionResults,
    };
  }).sort((a, b) => (b.submittedAt ?? "").localeCompare(a.submittedAt ?? ""));

  const gradedSubmissions = submissionsWithResults.filter((submission) => submission.percent !== null);
  const averagePercent = gradedSubmissions.length
    ? gradedSubmissions.reduce((total, submission) => total + (submission.percent ?? 0), 0) / gradedSubmissions.length
    : null;
  const passCount = gradedSubmissions.filter((submission) => submission.passed === true).length;

  return {
    id: quiz.id,
    title: quiz.title,
    description: quiz.description,
    roomCode,
    passMark: quiz.settings.passMark ?? null,
    submissionCount: submissionsWithResults.length,
    gradedCount: gradedSubmissions.length,
    averagePercent,
    passCount,
    questionStats: quizQuestions.map((question) => {
      const correctCount = submissionsWithResults.filter((submission) =>
        submission.questions.find((result) => result.id === question.id)?.isCorrect,
      ).length;
      return {
        id: question.id,
        question: question.question,
        correctCount,
        responseCount: submissionsWithResults.length,
        percentCorrect: submissionsWithResults.length
          ? (correctCount / submissionsWithResults.length) * 100
          : null,
      };
    }),
    submissions: submissionsWithResults,
  };
}

function spreadsheetSafe(value: string | number | boolean) {
  const text = String(value);
  return /^[\u0000-\u0020]*[=+\-@]/.test(text) ? `'${text}` : text;
}

export function exportResultsCsv(results: QuizResults[]) {
  const rows = results.flatMap((quiz) => quiz.submissions.map((submission) => ({
    Quiz: quiz.title,
    Participant: submission.displayName || "Anonymous participant",
    Submitted: submission.submittedAt ?? "",
    Score: submission.score ?? "",
    "Maximum score": submission.maxScore ?? "",
    "Percent score": submission.percent === null ? "" : submission.percent.toFixed(1),
    Passed: submission.passed === null ? "Not graded" : submission.passed ? "Yes" : "No",
    Responses: submission.questions
      .map((question, index) => `Q${index + 1}: ${question.selectedAnswers.join("; ") || "No answer"}`)
      .join(" | "),
  })));

  return buildCsv(rows.map((row) =>
    Object.fromEntries(Object.entries(row).map(([key, value]) => [
      key,
      typeof value === "string" ? spreadsheetSafe(value) : value,
    ])),
  ));
}
