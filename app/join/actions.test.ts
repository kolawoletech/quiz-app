import { describe, expect, it } from "vitest";

import { loadStudentSession, submitStudentQuiz } from "@/app/join/actions";

describe("student quiz actions", () => {
  it("loads only an open quiz and keeps answer keys off the client", async () => {
    const response = await loadStudentSession("8341");

    expect(response.ok).toBe(true);
    if (!response.ok) return;

    expect(response.session.title).toBe("Advanced C# First Hour");
    expect(response.session.questions).toHaveLength(3);
    expect(response.session.questions[0]).not.toHaveProperty("answer");
  });

  it("rejects invalid and inactive room codes", async () => {
    await expect(loadStudentSession("0000")).resolves.toMatchObject({ ok: false });
    await expect(loadStudentSession("9762")).resolves.toMatchObject({ ok: false });
  });

  it("rejects answers for unknown questions before attempting persistence", async () => {
    await expect(submitStudentQuiz({
      roomCode: "8341",
      answers: { unknown: ["answer"] },
      idToken: "test-token",
    })).rejects.toThrow("unknown question");
  });
});
