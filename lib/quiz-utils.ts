import type { Question } from "@/lib/mock-data";
import type { StudentSubmissionResult } from "@/lib/student-quiz";

export function generateRoomCode() {
  const digits = Array.from({ length: 4 }, () => Math.floor(Math.random() * 10)).join("");
  return digits;
}

export function gradeQuestionSubmission(
  question: { answer: string[]; type: string; points?: number },
  selected: string[],
) {
  const normalizedSelected = [...selected].map((value) => value.trim());
  const normalizedAnswer = [...question.answer].map((value) => value.trim());
  const points = question.points ?? 1;

  if (question.type === "multiple") {
    const correct = normalizedSelected.length === normalizedAnswer.length && normalizedSelected.every((item) => normalizedAnswer.includes(item));
    return { isCorrect: correct, score: correct ? points : 0 };
  }

  const answer = normalizedAnswer[0] ?? "";
  const selectedValue = normalizedSelected[0] ?? "";
  const isCorrect = answer.toLowerCase() === selectedValue.toLowerCase();
  return { isCorrect, score: isCorrect ? points : 0 };
}

export function gradeStudentQuizSubmission(
  questions: Question[],
  answers: Record<string, string[]>,
  settings: { showScoreAfterSubmit: boolean; showCorrectAnswersAfterSubmit: boolean },
): StudentSubmissionResult {
  let score = 0;
  const questionResults = questions.map((question) => {
    const result = gradeQuestionSubmission(question, answers[question.id] ?? []);
    score += result.score;

    return {
      questionId: question.id,
      isCorrect: result.isCorrect,
      earnedPoints: result.score,
      possiblePoints: question.points,
      ...(settings.showCorrectAnswersAfterSubmit
        ? { correctAnswer: question.answer.join(", "), explanation: question.explanation }
        : {}),
    };
  });

  return {
    score: settings.showScoreAfterSubmit ? score : null,
    maxScore: settings.showScoreAfterSubmit
      ? questions.reduce((total, question) => total + question.points, 0)
      : null,
    questionResults: settings.showCorrectAnswersAfterSubmit ? questionResults : null,
  };
}

export function buildCsv(rows: Array<Record<string, string | number | boolean>>) {
  if (!rows.length) return "";

  const headers = Object.keys(rows[0]);
  const escapeCell = (value: string | number | boolean) => `"${String(value).replaceAll('"', '""')}"`;
  const values = rows.map((row) =>
    headers.map((key) => escapeCell(row[key] ?? "")).join(","),
  );

  return [headers.map(escapeCell).join(","), ...values].join("\r\n");
}
