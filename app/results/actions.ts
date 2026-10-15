"use server";

import { Timestamp } from "firebase-admin/firestore";
import { z } from "zod";

import { getFirebaseAdminAuth, getFirebaseAdminFirestore } from "@/lib/firebase-admin";
import { isAuthorizedLecturer, parseLecturerAllowlist } from "@/lib/lecturer-access";
import { buildQuizResults, type StoredQuizSubmission } from "@/lib/results";
import { liveSessions, quizzes, questionBank } from "@/lib/mock-data";

const idTokenSchema = z.string().min(1).max(10_000);
const storedSubmissionSchema = z.object({
  displayName: z.string().nullable().optional(),
  answers: z.record(z.string(), z.array(z.string())),
  score: z.number().nullable().optional(),
  maxScore: z.number().nullable().optional(),
});

type LecturerResultsResponse =
  | { ok: true; email: string; quizzes: ReturnType<typeof buildQuizResults>[] }
  | { ok: false; error: string };

function toIsoString(value: unknown): string | null {
  let date: Date | null = null;
  if (value instanceof Timestamp) {
    date = value.toDate();
  } else if (value instanceof Date) {
    date = value;
  } else if (
    value !== null
    && typeof value === "object"
    && "toDate" in value
    && typeof value.toDate === "function"
  ) {
    date = value.toDate();
  }

  return date && Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

function isInvalidIdTokenError(error: unknown) {
  if (typeof error !== "object" || error === null || !("code" in error)) {
    return false;
  }

  return new Set([
    "auth/argument-error",
    "auth/id-token-expired",
    "auth/invalid-id-token",
    "auth/id-token-revoked",
    "auth/user-disabled",
    "auth/user-not-found",
  ]).has(String(error.code));
}

export async function getLecturerResults(rawIdToken: unknown): Promise<LecturerResultsResponse> {
  const parsedIdToken = idTokenSchema.safeParse(rawIdToken);
  if (!parsedIdToken.success) {
    return { ok: false, error: "Sign in with an authorized Google account to view results." };
  }

  const allowedEmails = parseLecturerAllowlist(process.env.LECTURER_EMAILS);
  if (allowedEmails.size === 0) {
    return { ok: false, error: "Lecturer access is not configured. Set the server-only LECTURER_EMAILS variable." };
  }

  let decodedToken;
  try {
    decodedToken = await getFirebaseAdminAuth().verifyIdToken(parsedIdToken.data, true);
  } catch (error) {
    if (isInvalidIdTokenError(error)) {
      return { ok: false, error: "Your sign-in has expired. Sign in again to view results." };
    }
    throw error;
  }

  const email = decodedToken.email ?? "";
  if (
    decodedToken.firebase.sign_in_provider !== "google.com"
    || decodedToken.email_verified !== true
    || !isAuthorizedLecturer(email, allowedEmails)
  ) {
    return { ok: false, error: "This Google account is not authorized to view quiz results." };
  }

  const firestore = getFirebaseAdminFirestore();
  const publishedQuizzes = quizzes.filter((quiz) => quiz.status === "published");
  const results = await Promise.all(publishedQuizzes.map(async (quiz) => {
    const snapshot = await firestore.collection("quizzes").doc(quiz.id).collection("submissions").get();
    const submissions: StoredQuizSubmission[] = snapshot.docs.map((document) => {
      const parsedSubmission = storedSubmissionSchema.safeParse(document.data());
      if (!parsedSubmission.success) {
        throw new Error(`Stored submission "${document.id}" for quiz "${quiz.id}" has an invalid format.`);
      }

      return {
        id: document.id,
        displayName: parsedSubmission.data.displayName ?? null,
        answers: parsedSubmission.data.answers,
        score: parsedSubmission.data.score ?? null,
        maxScore: parsedSubmission.data.maxScore ?? null,
        submittedAt: toIsoString(document.get("submittedAt")),
      };
    });

    const roomCode = liveSessions.find((session) => session.quizId === quiz.id)?.roomCode ?? null;
    return buildQuizResults(quiz, submissions, questionBank, roomCode);
  }));

  return { ok: true, email, quizzes: results };
}
