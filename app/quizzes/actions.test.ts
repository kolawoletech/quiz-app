import { beforeEach, describe, expect, it, vi } from "vitest";

import { releaseAnswerReview } from "@/app/quizzes/actions";
import { getFirebaseAdminFirestore } from "@/lib/firebase-admin";
import { verifyLecturerIdToken } from "@/lib/lecturer-auth";
import { parseQuiz } from "@/lib/quiz-store";
import type { Quiz } from "@/lib/mock-data";

vi.mock("@/lib/firebase-admin", () => ({
  getFirebaseAdminFirestore: vi.fn(),
}));

vi.mock("@/lib/lecturer-auth", () => ({
  verifyLecturerIdToken: vi.fn(),
}));

vi.mock("@/lib/quiz-store", () => ({
  getLecturerQuizzes: vi.fn(),
  parseQuiz: vi.fn(),
}));

const quiz: Quiz = {
  id: "quiz-1",
  title: "Test quiz",
  description: "",
  status: "published",
  answerReviewReleased: false,
  roomCode: "1234",
  questionIds: ["question-1"],
  settings: {
    shuffleQuestions: false,
    shuffleOptions: false,
    attemptLimit: 1,
    showScoreAfterSubmit: true,
    showCorrectAnswersAfterSubmit: false,
    mode: "self-paced",
  },
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const transactionGet = vi.fn();
const transactionUpdate = vi.fn();
const runTransaction = vi.fn(async (callback: (transaction: {
  get: typeof transactionGet;
  update: typeof transactionUpdate;
}) => unknown) => callback({ get: transactionGet, update: transactionUpdate }));
const quizRef = { id: quiz.id };

describe("releaseAnswerReview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(verifyLecturerIdToken).mockResolvedValue({
      ok: true,
      email: "lecturer@example.com",
    });
    vi.mocked(parseQuiz).mockReturnValue(quiz);
    vi.mocked(getFirebaseAdminFirestore).mockReturnValue({
      collection: () => ({ doc: () => quizRef }),
      runTransaction,
    } as never);
    transactionGet.mockResolvedValue({
      exists: true,
      id: quiz.id,
      data: () => ({}),
    });
  });

  it("releases review without editing the published quiz questions", async () => {
    const response = await releaseAnswerReview({ idToken: "lecturer-token", quizId: quiz.id });

    expect(response).toMatchObject({
      ok: true,
      data: { answerReviewReleased: true },
    });
    expect(transactionUpdate).toHaveBeenCalledWith(quizRef, expect.objectContaining({
      answerReviewReleased: true,
    }));
  });

  it("does not allow review release for drafts", async () => {
    vi.mocked(parseQuiz).mockReturnValue({ ...quiz, status: "draft" });

    const response = await releaseAnswerReview({ idToken: "lecturer-token", quizId: quiz.id });

    expect(response).toMatchObject({ ok: false, error: "Publish the quiz before releasing answer review." });
    expect(transactionUpdate).not.toHaveBeenCalled();
  });
});
