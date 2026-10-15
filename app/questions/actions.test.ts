import { beforeEach, describe, expect, it, vi } from "vitest";

import { loadLecturerQuestionBank } from "@/app/questions/actions";
import { getLecturerQuestionBank } from "@/lib/quiz-store";
import { verifyLecturerIdToken } from "@/lib/lecturer-auth";

vi.mock("@/lib/lecturer-auth", () => ({
  verifyLecturerIdToken: vi.fn(),
}));

vi.mock("@/lib/quiz-store", () => ({
  getLecturerQuestionBank: vi.fn(),
}));

describe("loadLecturerQuestionBank", () => {
  beforeEach(() => {
    vi.mocked(verifyLecturerIdToken).mockResolvedValue({ ok: false, error: "Not authorized." });
    vi.mocked(getLecturerQuestionBank).mockResolvedValue([]);
  });

  it("does not read question content unless the server verifies the lecturer", async () => {
    await expect(loadLecturerQuestionBank("untrusted-token")).resolves.toEqual({
      ok: false,
      error: "Not authorized.",
    });
    expect(getLecturerQuestionBank).not.toHaveBeenCalled();
  });

  it("loads the protected question bank after lecturer verification", async () => {
    vi.mocked(verifyLecturerIdToken).mockResolvedValue({ ok: true, email: "lecturer@example.com" });
    vi.mocked(getLecturerQuestionBank).mockResolvedValue([{
      id: "question-1",
      type: "single",
      question: "Private question",
      options: ["Correct"],
      answer: ["Correct"],
      explanation: "Private explanation",
      points: 1,
      difficulty: "easy",
      tags: [],
      ownerUid: "lecturer",
      createdAt: "2026-01-01T00:00:00.000Z",
    }]);

    await expect(loadLecturerQuestionBank("verified-token")).resolves.toMatchObject({
      ok: true,
      email: "lecturer@example.com",
      questions: [{ answer: ["Correct"] }],
    });
  });
});
