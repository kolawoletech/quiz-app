"use server";

import { verifyLecturerIdToken } from "@/lib/lecturer-auth";
import { getLecturerQuestionBank } from "@/lib/quiz-store";

export async function loadLecturerQuestionBank(idToken: unknown) {
  const authorization = await verifyLecturerIdToken(idToken);
  if (!authorization.ok) return authorization;

  const questions = await getLecturerQuestionBank();
  return { ok: true as const, email: authorization.email, questions };
}
