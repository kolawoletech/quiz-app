import { describe, expect, it } from "vitest";

import { buildCsv, generateRoomCode, gradeQuestionSubmission } from "@/lib/quiz-utils";

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
});
