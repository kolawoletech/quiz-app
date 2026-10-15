import { describe, expect, it } from "vitest";

import { buildCsv, generateRoomCode, gradeQuestionSubmission, gradeStudentQuizSubmission } from "@/lib/quiz-utils";
import type { Question } from "@/lib/mock-data";

const questions: Question[] = [
  {
    id: "q1",
    type: "single",
    question: "Select the correct option.",
    options: ["A", "B"],
    answer: ["A"],
    explanation: "A is correct.",
    points: 1,
    difficulty: "easy",
    tags: [],
    ownerUid: "test",
    createdAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "q2",
    type: "multiple",
    question: "Select both correct options.",
    options: ["A", "B", "C"],
    answer: ["A", "C"],
    explanation: "A and C are correct.",
    points: 2,
    difficulty: "medium",
    tags: [],
    ownerUid: "test",
    createdAt: "2026-01-01T00:00:00.000Z",
  },
];

describe("generateRoomCode", () => {
  it("creates a four-digit code", () => {
    const code = generateRoomCode();
    expect(code).toMatch(/^\d{4}$/);
  });
});

describe("gradeQuestionSubmission", () => {
  it("grades a multiple-choice answer correctly", () => {
    const result = gradeQuestionSubmission({ answer: ["B"], type: "single" }, ["B"]);
    expect(result.isCorrect).toBe(true);
    expect(result.score).toBe(1);
  });

  it("grades a multiple-select answer accurately", () => {
    const result = gradeQuestionSubmission({ answer: ["A", "C"], type: "multiple" }, ["A", "C"]);
    expect(result.isCorrect).toBe(true);
    expect(result.score).toBe(1);
  });

  it("awards the question's configured points", () => {
    const result = gradeQuestionSubmission({ answer: ["sealed"], type: "short", points: 2 }, ["sealed"]);
    expect(result.score).toBe(2);
  });

  it("returns a weighted quiz total without leaking answer review when disabled", () => {
    const result = gradeStudentQuizSubmission(
      questions,
      {
        q1: ["A"],
        q2: ["A", "C"],
      },
      { showScoreAfterSubmit: true, showCorrectAnswersAfterSubmit: false },
    );

    expect(result.score).toBe(3);
    expect(result.maxScore).toBe(3);
    expect(result.questionResults).toBeNull();
  });

  it("hides score and includes review only when quiz settings allow it", () => {
    const result = gradeStudentQuizSubmission(
      questions.slice(0, 1),
      { q1: ["wrong"] },
      { showScoreAfterSubmit: false, showCorrectAnswersAfterSubmit: true },
    );

    expect(result.score).toBeNull();
    expect(result.maxScore).toBeNull();
    expect(result.questionResults?.[0]?.correctAnswer).toBe(questions[0]?.answer.join(", "));
  });
});

describe("buildCsv", () => {
  it("builds a csv string with a header row", () => {
    const csv = buildCsv([
      { student: "STU-7K42", score: 85, passed: true },
      { student: "STU-8M11", score: 70, passed: false },
    ]);

    expect(csv).toContain("student");
    expect(csv).toContain("score");
    expect(csv).toContain("STU-7K42");
  });

  it("escapes commas, quotes, and line breaks in headers and values", () => {
    const csv = buildCsv([{ 'question, "quoted"': "line 1\nline 2, \"answer\"" }]);

    expect(csv).toBe('"question, ""quoted"""\r\n"line 1\nline 2, ""answer"""');
  });
});
