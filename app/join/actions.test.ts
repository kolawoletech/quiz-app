import { beforeEach, describe, expect, it, vi } from "vitest";

import { loadStudentSession, submitStudentQuiz } from "@/app/join/actions";
import { getPublishedQuizByRoomCode } from "@/lib/quiz-store";
import type { Question, Quiz } from "@/lib/mock-data";

vi.mock("@/lib/quiz-store", () => ({
  getPublishedQuizByRoomCode: vi.fn(),
}));

const questions: Question[] = Array.from({ length: 22 }, (_, index) => ({
  id: `basic-q${index + 1}`,
  type: "single",
  question: `Practice question ${index + 1}`,
  options: ["Correct", "Incorrect"],
  answer: ["Correct"],
  explanation: "The first option is correct.",
  points: 1,
  difficulty: "unrated",
  tags: ["practice"],
  ownerUid: "practice-sample",
  createdAt: "2026-01-01T00:00:00.000Z",
}));

const quiz: Quiz = {
  id: "quiz-basic-csharp-practice",
  title: "Basic C# Practice Quiz",
  description: "Practice assessment.",
  status: "published",
  roomCode: "9762",
  questionIds: questions.map((question) => question.id),
  settings: {
    shuffleQuestions: false,
    shuffleOptions: false,
    allowOneAttempt: false,
    showScoreAfterSubmit: true,
    showCorrectAnswersAfterSubmit: false,
    passMark: 50,
    mode: "self-paced",
  },
  updatedAt: "2026-01-01T00:00:00.000Z",
};

describe("student quiz actions", () => {
  beforeEach(() => {
    vi.mocked(getPublishedQuizByRoomCode).mockImplementation(async (roomCode) =>
      roomCode === quiz.roomCode ? { quiz, questions } : null,
    );
  });

  it("loads published quiz content from storage without returning answer keys", async () => {
    const response = await loadStudentSession("9762");

    expect(response.ok).toBe(true);
    if (!response.ok) return;

    expect(response.session.title).toBe("Basic C# Practice Quiz");
    expect(response.session.questions).toHaveLength(22);
    expect(response.session.questions[0]).not.toHaveProperty("answer");
    expect(response.session.questions[0]).not.toHaveProperty("explanation");
  });

  it("rejects invalid and inactive room codes", async () => {
    await expect(loadStudentSession("not a code")).resolves.toMatchObject({ ok: false });
    await expect(loadStudentSession("0001")).resolves.toMatchObject({ ok: false });
  });

  it("rejects answers for unknown questions before attempting persistence", async () => {
    await expect(submitStudentQuiz({
      roomCode: "9762",
      answers: { unknown: ["answer"] },
      idToken: "test-token",
    })).rejects.toThrow("unknown question");
  });
});
