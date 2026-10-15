import { describe, expect, it } from "vitest";

import { importPayloadSchema, questionSchema } from "@/lib/schemas";

describe("questionSchema", () => {
  it("accepts a valid single-choice question", () => {
    const valid = {
      id: "q1",
      type: "single",
      question: "What is the capital of South Africa?",
      options: [
        { id: "A", text: "Cape Town" },
        { id: "B", text: "Pretoria" },
      ],
      answer: ["B"],
      explanation: "Pretoria is the administrative capital.",
      points: 1,
      difficulty: "easy",
      tags: ["geography"],
    };

    expect(() => questionSchema.parse(valid)).not.toThrow();
  });
});

describe("importPayloadSchema", () => {
  it("accepts a quiz import document", () => {
    const payload = {
      quiz: {
        title: "Advanced C# First Hour",
        description: "Review of attributes",
        settings: {
          title: "Advanced C# First Hour",
          description: "Review of attributes",
          shuffleQuestions: true,
          shuffleOptions: true,
          allowOneAttempt: true,
          showScoreAfterSubmit: true,
          showCorrectAnswersAfterSubmit: false,
          defaultPoints: 1,
          mode: "self-paced",
        },
        questions: [
          {
            id: "q1",
            type: "single",
            question: "What does ConditionalAttribute do?",
            options: [
              { id: "A", text: "Class inheritance" },
              { id: "B", text: "Conditionally include calls" },
            ],
            answer: ["B"],
            explanation: "It controls conditional compilation.",
            points: 1,
            difficulty: "easy",
            tags: ["C#"],
          },
        ],
      },
    };

    expect(() => importPayloadSchema.parse(payload)).not.toThrow();
  });
});
