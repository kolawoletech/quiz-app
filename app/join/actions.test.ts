import { describe, expect, it } from "vitest";

import { loadStudentSession, submitStudentQuiz } from "@/app/join/actions";

describe("student quiz actions", () => {
  it("loads an open quiz and keeps answer keys off the client", async () => {
    const response = await loadStudentSession("9762");

    expect(response.ok).toBe(true);
    if (!response.ok) return;

    expect(response.session.title).toBe("Basic C# Practice Quiz");
    expect(response.session.questions).toHaveLength(22);
    expect(response.session.questions[0]).not.toHaveProperty("answer");
  });

  it("rejects invalid and inactive room codes", async () => {
    await expect(loadStudentSession("0000")).resolves.toMatchObject({ ok: false });
    await expect(loadStudentSession("0001")).resolves.toMatchObject({ ok: false });
  });

  it("loads both supplied sample quizzes without exposing answer keys", async () => {
    const response = await loadStudentSession("9762");
    const advancedResponse = await loadStudentSession("8341");

    expect(response.ok).toBe(true);
    if (!response.ok) return;
    expect(response.session.title).toBe("Basic C# Practice Quiz");
    expect(response.session.questions).toHaveLength(22);
    expect(response.session.settings.passMark).toBe(50);
    expect(response.session.questions.every((question) => !("answer" in question))).toBe(true);
    expect(response.session.questions.some((question) => question.codeSnippet)).toBe(true);

    expect(advancedResponse.ok).toBe(true);
    if (!advancedResponse.ok) return;
    expect(advancedResponse.session.title).toBe("Advanced C# Practice Quiz");
    expect(advancedResponse.session.questions).toHaveLength(30);
    expect(advancedResponse.session.questions.every((question) => !("answer" in question))).toBe(true);
  });

  it("rejects answers for unknown questions before attempting persistence", async () => {
    await expect(submitStudentQuiz({
      roomCode: "9762",
      answers: { unknown: ["answer"] },
      idToken: "test-token",
    })).rejects.toThrow("unknown question");
  });
});
