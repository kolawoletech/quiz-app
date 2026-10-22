import { describe, expect, it } from "vitest";

import { isAuthorizedLecturer, parseLecturerAllowlist } from "@/lib/lecturer-access";
import { exportResultsCsv, buildQuizResults } from "@/lib/results";
import type { Question, Quiz } from "@/lib/mock-data";

const question: Question = {
  id: "q1",
  type: "single",
  question: "Choose the correct answer.",
  options: ["Correct", "Incorrect"],
  answer: ["Correct"],
  explanation: "Correct is correct.",
  points: 1,
  difficulty: "easy",
  tags: [],
  ownerUid: "test",
  createdAt: "2026-01-01T00:00:00.000Z",
};

const basicQuiz: Quiz = {
  id: "quiz-test",
  title: "Test quiz",
  description: "Test quiz description",
  status: "published",
  roomCode: "9762",
  questionIds: [question.id],
  settings: {
    shuffleQuestions: false,
    shuffleOptions: false,
    attemptLimit: 1,
    showScoreAfterSubmit: true,
    showCorrectAnswersAfterSubmit: false,
    passMark: 50,
    mode: "self-paced",
  },
  updatedAt: "2026-01-01T00:00:00.000Z",
};

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
    const results = buildQuizResults(basicQuiz, [
      {
        id: "correct",
        displayName: "Ada",
        answers: { [question.id]: question.answer },
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
    ], [question], "9762");

    expect(results.roomCode).toBe("9762");
    expect(results.submissionCount).toBe(2);
    expect(results.gradedCount).toBe(2);
    expect(results.averagePercent).toBe(50);
    expect(results.passCount).toBe(1);
    expect(results.passPercentage).toBe(50);
    expect(results.submissions[0]?.displayName).toBe("Ada");
    expect(results.submissions[0]?.score).toBe(question.points);
    expect(results.submissions[0]?.passed).toBe(true);
    expect(results.submissions[1]?.passed).toBe(false);
    expect(results.questionStats[0]).toMatchObject({
      correctCount: 1,
      responseCount: 2,
      percentCorrect: 50,
      averageScorePercent: 50,
    });
  });

  it("includes matching partial credit in average question performance", () => {
    const matchingQuestion: Question = {
      ...question,
      id: "matching",
      type: "matching",
      matchItems: ["One", "Two"],
      options: ["First", "Second"],
      answer: ["First", "Second"],
      points: 2,
    };
    const results = buildQuizResults({ ...basicQuiz, questionIds: [matchingQuestion.id] }, [
      {
        id: "partial",
        displayName: "Ada",
        answers: { matching: ["First", "wrong"] },
        score: null,
        maxScore: null,
        submittedAt: null,
      },
    ], [matchingQuestion]);

    expect(results.questionStats[0]).toMatchObject({
      correctCount: 0,
      responseCount: 1,
      percentCorrect: 0,
      averageScorePercent: 50,
    });
  });

  it("does not report a pass percentage when the quiz has no pass mark", () => {
    const quizWithoutPassMark = {
      ...basicQuiz,
      settings: { ...basicQuiz.settings, passMark: undefined },
    };
    const results = buildQuizResults(quizWithoutPassMark, [{
      id: "participant",
      displayName: "Ada",
      answers: { [question.id]: question.answer },
      score: null,
      maxScore: null,
      submittedAt: null,
    }], [question]);

    expect(results.passCount).toBe(0);
    expect(results.passPercentage).toBeNull();
  });

  it("exports quoted CSV cells and protects spreadsheet formula values", () => {
    const result = buildQuizResults(basicQuiz, [{
      id: "participant-1",
      displayName: '=HYPERLINK("https://example.com")',
      answers: {},
      score: null,
      maxScore: null,
      submittedAt: null,
    }], [question]);
    const csv = exportResultsCsv([result]);

    expect(csv).toContain('"Participant"');
    expect(csv).toContain('"\'=HYPERLINK(""https://example.com"")"');
    expect(csv).toContain('"Q1: No answer');
    expect(exportResultsCsv([])).toBe("");
  });

  it("fails explicitly when a quiz references a missing question", () => {
    const brokenQuiz = { ...basicQuiz, questionIds: ["missing-question"] };
    expect(() => buildQuizResults(brokenQuiz, [], [question])).toThrow(/missing question/);
  });
});
