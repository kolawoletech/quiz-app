import { describe, expect, it } from "vitest";

import { mapPracticeQuiz } from "./practice-import.mjs";

const sourceQuiz = {
  title: "Basic practice test",
  description: "A small fixture",
  subject: "Programming",
  version: 1,
  settings: {
    shuffleQuestions: false,
    shuffleOptions: false,
    showExplanations: true,
    passMark: 50,
  },
  questions: [{
    id: "Q1",
    type: "multiple-choice",
    points: 2,
    question: "Which option is correct?",
    options: [
      { id: "A", text: "Answer one" },
      { id: "B", text: "Answer two" },
    ],
    answer: "B",
    explanation: "Answer two is correct.",
  }],
};

describe("mapPracticeQuiz", () => {
  it("creates a Firestore quiz record and server-side question records", () => {
    const result = mapPracticeQuiz(sourceQuiz, {
      id: "quiz-basic-csharp-practice",
      codePrefix: "basic",
      roomCode: "9762",
    });

    expect(result.quiz).toMatchObject({
      title: "Basic practice test",
      status: "published",
      roomCode: "9762",
      questionIds: ["basic-Q1"],
      settings: { passMark: 50, showCorrectAnswersAfterSubmit: true },
    });
    expect(result.questions[0]).toMatchObject({
      id: "basic-Q1",
      order: 0,
      options: ["Answer one", "Answer two"],
      answer: ["Answer two"],
      explanation: "Answer two is correct.",
    });
  });

  it("imports native matching and rearrange questions without losing their type or answer data", () => {
    const result = mapPracticeQuiz({
      title: "Question types",
      description: "Matching and ranking import.",
      subject: "Programming",
      settings: { passMark: 60 },
      questions: [
        {
          id: "match-1",
          type: "matching",
          question: "Match each term.",
          matchItems: ["Class", "Method"],
          options: ["Blueprint", "Operation"],
          answer: ["Blueprint", "Operation"],
          points: 2,
        },
        {
          id: "rank-1",
          type: "rearrange",
          question: "Put these lines in order.",
          options: ["}", "if (ready) {", "  start();"],
          answer: ["if (ready) {", "  start();", "}"],
          points: 3,
        },
      ],
    }, { codePrefix: "newtypes", roomCode: "1234" });

    expect(result.quiz).toMatchObject({
      status: "draft",
      roomCode: "1234",
      settings: { attemptLimit: 3, passMark: 60 },
      questionIds: ["newtypes-match-1", "newtypes-rank-1"],
    });
    expect(result.questions[0]).toMatchObject({
      type: "matching",
      matchItems: ["Class", "Method"],
      options: ["Blueprint", "Operation"],
      answer: ["Blueprint", "Operation"],
    });
    expect(result.questions[1]).toMatchObject({
      type: "rearrange",
      options: ["}", "if (ready) {", "  start();"],
      answer: ["if (ready) {", "  start();", "}"],
    });
  });

  it("rejects invalid native matching answer references", () => {
    expect(() => mapPracticeQuiz({
      title: "Invalid matching",
      questions: [{
        id: "match-1",
        type: "matching",
        question: "Match these.",
        matchItems: ["A", "B"],
        options: ["One", "Two"],
        answer: ["One", "Missing"],
        points: 2,
      }],
    }, { codePrefix: "test", roomCode: "0001" })).toThrow(/one unique valid option/);
  });

  it("fails on invalid question answer references", () => {
    expect(() => mapPracticeQuiz({
      ...sourceQuiz,
      questions: [{ ...sourceQuiz.questions[0], answer: "missing-option" }],
    }, { id: "quiz", codePrefix: "test", roomCode: "0001" })).toThrow(/unknown answer option/);
  });

  it("rejects question IDs that cannot be safely used as Firestore document IDs", () => {
    expect(() => mapPracticeQuiz({
      ...sourceQuiz,
      questions: [{ ...sourceQuiz.questions[0], id: "bad/question" }],
    }, { id: "quiz", codePrefix: "test", roomCode: "0001" })).toThrow();
  });

  it("rejects ambiguous duplicate options", () => {
    expect(() => mapPracticeQuiz({
      ...sourceQuiz,
      questions: [{
        ...sourceQuiz.questions[0],
        options: [
          { id: "A", text: "Same answer" },
          { id: "B", text: "Same answer" },
        ],
      }],
    }, { id: "quiz", codePrefix: "test", roomCode: "0001" })).toThrow(/unique option IDs and option text/);
  });
});
