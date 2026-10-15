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

  it("fails on invalid question answer references", () => {
    expect(() => mapPracticeQuiz({
      ...sourceQuiz,
      questions: [{ ...sourceQuiz.questions[0], answer: "missing-option" }],
    }, { id: "quiz", codePrefix: "test", roomCode: "0001" })).toThrow(/unknown answer option/);
  });
});
