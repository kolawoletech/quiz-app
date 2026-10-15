import { describe, expect, it } from "vitest";

import { isAuthorizedLecturer, parseLecturerAllowlist } from "@/lib/lecturer-access";
import { exportResultsCsv, buildQuizResults } from "@/lib/results";
import { questionBank, quizzes } from "@/lib/mock-data";

const basicQuiz = quizzes.find((quiz) => quiz.id === "quiz-basic-csharp-practice");
if (!basicQuiz) {
  throw new Error("Basic C# practice quiz fixture is missing.");
}

describe("lecturer access", () => {
  it("parses and compares allowlisted emails without case sensitivity", () => {
    const allowlist = parseLecturerAllowlist(" Lecturer@Example.com, another@example.com , ");

    expect(allowlist).toEqual(new Set(["lecturer@example.com", "another@example.com"]));
    expect(isAuthorizedLecturer("LECTURER@example.com", allowlist)).toBe(true);
    expect(isAuthorizedLecturer("unlisted@example.com", allowlist)).toBe(false);
    expect(parseLecturerAllowlist(undefined).size).toBe(0);
  });
});

describe("buildQuizResults", () => {
  it("computes scores, pass status, participant summaries, and question performance", () => {
    const quiz = {
      ...basicQuiz,
      settings: { ...basicQuiz.settings, passMark: 60 },
    };
    const questions = quiz.questionIds.map((id) => {
      const question = questionBank.find((candidate) => candidate.id === id);
      if (!question) throw new Error(`Missing question fixture: ${id}`);
      return question;
    });
    const results = buildQuizResults(quiz, [
      {
        id: "correct",
        displayName: "Ada",
        answers: Object.fromEntries(questions.map((question) => [question.id, question.answer])),
        score: null,
        maxScore: null,
        submittedAt: "2026-01-02T12:00:00.000Z",
      },
      {
        id: "incorrect",
        displayName: "Grace",
        answers: {},
        score: null,
        maxScore: null,
        submittedAt: "2026-01-01T12:00:00.000Z",
      },
    ], questionBank, "9762");

    expect(results.roomCode).toBe("9762");
    expect(results.submissionCount).toBe(2);
    expect(results.gradedCount).toBe(2);
    expect(results.averagePercent).toBe(50);
    expect(results.passCount).toBe(1);
    expect(results.submissions[0]?.displayName).toBe("Ada");
    expect(results.submissions[0]?.score).toBe(questions.reduce((sum, question) => sum + question.points, 0));
    expect(results.submissions[0]?.passed).toBe(true);
    expect(results.submissions[1]?.passed).toBe(false);
    expect(results.questionStats[0]).toMatchObject({ correctCount: 1, responseCount: 2, percentCorrect: 50 });
  });

  it("exports quoted CSV cells and protects spreadsheet formula values", () => {
    const result = buildQuizResults(basicQuiz, [{
      id: "participant-1",
      displayName: '=HYPERLINK("https://example.com")',
      answers: {},
      score: null,
      maxScore: null,
      submittedAt: null,
    }], questionBank);
    const csv = exportResultsCsv([result]);

    expect(csv).toContain('"Participant"');
    expect(csv).toContain('"\'=HYPERLINK(""https://example.com"")"');
    expect(csv).toContain('"Q1: No answer');
    expect(exportResultsCsv([])).toBe("");
  });

  it("fails explicitly when a quiz references a missing question", () => {
    const brokenQuiz = { ...basicQuiz, questionIds: ["missing-question"] };
    expect(() => buildQuizResults(brokenQuiz, [], questionBank)).toThrow(/missing question/);
  });
});
