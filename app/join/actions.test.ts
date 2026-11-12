import { beforeEach, describe, expect, it, vi } from "vitest";

import { loadStudentAnswerReview, loadStudentSession, submitStudentQuiz } from "@/app/join/actions";
import { getFirebaseAdminAuth, getFirebaseAdminFirestore } from "@/lib/firebase-admin";
import { getQuizByRoomCode } from "@/lib/quiz-store";
import type { Question, Quiz } from "@/lib/mock-data";

vi.mock("@/lib/quiz-store", () => ({
  getQuizByRoomCode: vi.fn(),
}));

vi.mock("@/lib/firebase-admin", () => ({
  getFirebaseAdminAuth: vi.fn(),
  getFirebaseAdminFirestore: vi.fn(),
}));

const verifyIdToken = vi.fn();
const submissionsGet = vi.fn();
const savedSubmissionGet = vi.fn();
const submissionsWhere = vi.fn(() => ({ get: submissionsGet, kind: "attempts-query" }));
const transactionGet = vi.fn();
const transactionCreate = vi.fn();
const runTransaction = vi.fn(async (callback: (transaction: { get: typeof transactionGet; create: typeof transactionCreate }) => unknown) =>
  callback({ get: transactionGet, create: transactionCreate }),
);
const firestoreCollection = vi.fn(() => ({
  doc: () => ({
    kind: "quiz",
    collection: () => ({
      doc: (id: string) => ({ kind: "submission", id, get: savedSubmissionGet }),
      where: submissionsWhere,
    }),
  }),
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
  answerReviewReleased: false,
  roomCode: "9762",
  questionIds: questions.map((question) => question.id),
  settings: {
    shuffleQuestions: false,
    shuffleOptions: false,
    attemptLimit: 3,
    showScoreAfterSubmit: true,
    showCorrectAnswersAfterSubmit: false,
    passMark: 50,
    mode: "self-paced",
  },
  updatedAt: "2026-01-01T00:00:00.000Z",
};

describe("student quiz actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getQuizByRoomCode).mockImplementation(async (roomCode) =>
      roomCode === quiz.roomCode ? { quiz, questions } : null,
    );
    vi.mocked(getFirebaseAdminAuth).mockReturnValue({
      verifyIdToken,
    } as never);
    vi.mocked(getFirebaseAdminFirestore).mockReturnValue({
      collection: firestoreCollection,
      runTransaction,
    } as never);
    verifyIdToken.mockResolvedValue({
      uid: "anonymous-user",
      firebase: { sign_in_provider: "anonymous" },
    });
    submissionsGet.mockResolvedValue({ size: 1 });
    savedSubmissionGet.mockResolvedValue({
      exists: true,
      data: () => ({
        participantUid: "anonymous-user",
        answers: { "basic-q1": ["Incorrect"] },
      }),
    });
    transactionGet.mockImplementation(async (reference: { kind: string }) => {
      if (reference.kind === "quiz") {
        return {
          exists: true,
          get: (field: string) => field === "status" ? "published" : undefined,
        };
      }
      if (reference.kind === "submission") return { exists: false };
      return { size: 1 };
    });
  });

  it("loads published quiz content from storage without returning answer keys", async () => {
    const response = await loadStudentSession("9762", "student-token");

    expect(response.ok).toBe(true);
    if (!response.ok) return;

    expect(response.session.title).toBe("Basic C# Practice Quiz");
    expect(response.session.attemptsUsed).toBe(1);
    expect(response.session.attemptsRemaining).toBe(2);
    expect(response.session.attemptLimit).toBe(3);
    expect(response.session.questions).toHaveLength(22);
    expect(response.session.questions[0]).not.toHaveProperty("answer");
    expect(response.session.questions[0]).not.toHaveProperty("explanation");
  });

  it("rejects invalid and inactive room codes", async () => {
    await expect(loadStudentSession("not a code", "student-token")).resolves.toMatchObject({ ok: false });
    await expect(loadStudentSession("0001", "student-token")).resolves.toMatchObject({ ok: false });
  });

  it("blocks students after they use the configured attempt limit", async () => {
    submissionsGet.mockResolvedValue({ size: 3 });

    await expect(loadStudentSession("9762", "student-token")).resolves.toMatchObject({
      ok: false,
      error: "You have used all 3 attempts for this quiz.",
    });
  });

  it("allows exhausted students to rejoin and view their review after release", async () => {
    vi.mocked(getQuizByRoomCode).mockResolvedValue({
      quiz: { ...quiz, answerReviewReleased: true },
      questions,
    });
    submissionsGet.mockResolvedValue({
      size: 3,
      docs: [{
        get: (field: string) => field === "submittedAt" ? new Date("2026-01-02T00:00:00.000Z") : undefined,
        data: () => ({
          participantUid: "anonymous-user",
          answers: { "basic-q1": ["Incorrect"] },
        }),
      }],
    });

    const response = await loadStudentSession("9762", "student-token");

    expect(response.ok).toBe(true);
    if (response.ok) {
      expect(response.session.attemptsRemaining).toBe(0);
      expect(response.previousReview?.questionResults).toContainEqual(expect.objectContaining({
        questionId: "basic-q1",
        correctAnswer: "Correct",
      }));
    }
  });

  it("shows a prior released review before offering another allowed attempt", async () => {
    vi.mocked(getQuizByRoomCode).mockResolvedValue({
      quiz: { ...quiz, answerReviewReleased: true },
      questions,
    });
    submissionsGet.mockResolvedValue({
      size: 1,
      docs: [{
        get: (field: string) => field === "submittedAt" ? new Date("2026-01-02T00:00:00.000Z") : undefined,
        data: () => ({
          participantUid: "anonymous-user",
          answers: { "basic-q1": ["Incorrect"] },
        }),
      }],
    });

    const response = await loadStudentSession("9762", "student-token");

    expect(response.ok).toBe(true);
    if (response.ok) {
      expect(response.session.attemptsRemaining).toBe(2);
      expect(response.previousReview?.questionResults).toContainEqual(expect.objectContaining({
        questionId: "basic-q1",
        correctAnswer: "Correct",
      }));
    }
  });

  it("rejects answers for unknown questions before attempting persistence", async () => {
    await expect(submitStudentQuiz({
      roomCode: "9762",
      answers: { unknown: ["answer"] },
      attemptId: "3bfa4214-2cda-4d0e-8d85-3d79f7c36a29",
      idToken: "test-token",
    })).rejects.toThrow("unknown question");
  });

  it("enforces the attempt limit inside the submission transaction", async () => {
    transactionGet.mockImplementation(async (reference: { kind: string }) => {
      if (reference.kind === "quiz") {
        return { exists: true, get: (field: string) => field === "status" ? "published" : undefined };
      }
      if (reference.kind === "submission") return { exists: false };
      return { size: 3 };
    });

    await expect(submitStudentQuiz({
      roomCode: "9762",
      answers: {},
      attemptId: "3bfa4214-2cda-4d0e-8d85-3d79f7c36a29",
      idToken: "student-token",
    })).rejects.toThrow("You have used all 3 attempts");
    expect(transactionCreate).not.toHaveBeenCalled();
  });

  it("accepts unanswered matching entries so timed-out quizzes can be submitted", async () => {
    const matchingQuestion: Question = {
      ...questions[0]!,
      id: "matching-question",
      type: "matching",
      matchItems: ["First item", "Second item"],
      options: ["First match", "Second match"],
      answer: ["First match", "Second match"],
      points: 2,
    };
    vi.mocked(getQuizByRoomCode).mockResolvedValue({
      quiz: { ...quiz, questionIds: [matchingQuestion.id], settings: { ...quiz.settings, timeLimitMinutes: 1 } },
      questions: [matchingQuestion],
    });

    await expect(submitStudentQuiz({
      roomCode: "9762",
      answers: {},
      attemptId: "3bfa4214-2cda-4d0e-8d85-3d79f7c36a29",
      idToken: "student-token",
    })).resolves.toMatchObject({ score: 0, maxScore: 2 });
    expect(transactionCreate).toHaveBeenCalledOnce();
  });

  it("returns the saved result when an attempt is retried", async () => {
    const savedResult = { score: 1, maxScore: 22, questionResults: null };
    transactionGet.mockImplementation(async (reference: { kind: string }) => {
      if (reference.kind === "submission") {
        return {
          exists: true,
          get: () => "anonymous-user",
          data: () => savedResult,
        };
      }
      if (reference.kind === "quiz") {
        return { exists: true, get: (field: string) => field === "answerReviewReleased" ? false : undefined };
      }
      return { size: 3 };
    });

    await expect(submitStudentQuiz({
      roomCode: "9762",
      answers: {},
      attemptId: "3bfa4214-2cda-4d0e-8d85-3d79f7c36a29",
      idToken: "student-token",
    })).resolves.toEqual(savedResult);
    expect(transactionCreate).not.toHaveBeenCalled();
  });

  it("keeps answer review unavailable until the lecturer releases it", async () => {
    const response = await submitStudentQuiz({
      roomCode: "9762",
      answers: { "basic-q1": ["Correct"] },
      attemptId: "3bfa4214-2cda-4d0e-8d85-3d79f7c36a29",
      idToken: "student-token",
    });

    expect(response.questionResults).toBeNull();
  });

  it("includes answer review in new submissions after release", async () => {
    vi.mocked(getQuizByRoomCode).mockResolvedValue({
      quiz: { ...quiz, answerReviewReleased: true },
      questions,
    });
    transactionGet.mockImplementation(async (reference: { kind: string }) => {
      if (reference.kind === "quiz") {
        return {
          exists: true,
          get: (field: string) => field === "status"
            ? "published"
            : field === "answerReviewReleased" ? true : undefined,
        };
      }
      if (reference.kind === "submission") return { exists: false };
      return { size: 1 };
    });

    const response = await submitStudentQuiz({
      roomCode: "9762",
      answers: { "basic-q1": ["Correct"] },
      attemptId: "3bfa4214-2cda-4d0e-8d85-3d79f7c36a29",
      idToken: "student-token",
    });

    expect(response.questionResults).toContainEqual(expect.objectContaining({
      questionId: "basic-q1",
      correctAnswer: "Correct",
    }));
  });

  it("returns answer review for a student's own submission after release", async () => {
    vi.mocked(getQuizByRoomCode).mockResolvedValue({
      quiz: { ...quiz, answerReviewReleased: true },
      questions,
    });

    const response = await loadStudentAnswerReview({
      roomCode: "9762",
      attemptId: "3bfa4214-2cda-4d0e-8d85-3d79f7c36a29",
      idToken: "student-token",
    });

    expect(response).toMatchObject({ ok: true, available: true });
    if (response.ok && response.available) {
      expect(response.result?.questionResults).toContainEqual(expect.objectContaining({
        questionId: "basic-q1",
        correctAnswer: "Correct",
      }));
    }
  });

  it("does not return another student's answer review", async () => {
    vi.mocked(getQuizByRoomCode).mockResolvedValue({
      quiz: { ...quiz, answerReviewReleased: true },
      questions,
    });
    savedSubmissionGet.mockResolvedValue({
      exists: true,
      data: () => ({
        participantUid: "different-student",
        answers: { "basic-q1": ["Correct"] },
      }),
    });

    await expect(loadStudentAnswerReview({
      roomCode: "9762",
      attemptId: "3bfa4214-2cda-4d0e-8d85-3d79f7c36a29",
      idToken: "student-token",
    })).resolves.toMatchObject({ ok: false, error: "That submission could not be found." });
  });
});
