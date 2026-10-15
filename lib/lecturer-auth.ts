import "server-only";

import { z } from "zod";

import { getFirebaseAdminAuth } from "@/lib/firebase-admin";
import { isAuthorizedLecturer, parseLecturerAllowlist } from "@/lib/lecturer-access";

const idTokenSchema = z.string().min(1).max(10_000);

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

export async function verifyLecturerIdToken(rawIdToken: unknown) {
  const parsedIdToken = idTokenSchema.safeParse(rawIdToken);
  if (!parsedIdToken.success) {
    return { ok: false as const, error: "Sign in with an authorized Google account to continue." };
  }

  const allowedEmails = parseLecturerAllowlist(process.env.LECTURER_EMAILS);
  if (allowedEmails.size === 0) {
    return { ok: false as const, error: "Lecturer access is not configured. Set the server-only LECTURER_EMAILS variable." };
  }

  let decodedToken;
  try {
    decodedToken = await getFirebaseAdminAuth().verifyIdToken(parsedIdToken.data, true);
  } catch (error) {
    if (isInvalidIdTokenError(error)) {
      return { ok: false as const, error: "Your sign-in has expired. Sign in again to continue." };
    }
    throw error;
  }

  const email = decodedToken.email ?? "";
  if (
    decodedToken.firebase.sign_in_provider !== "google.com"
    || decodedToken.email_verified !== true
    || !isAuthorizedLecturer(email, allowedEmails)
  ) {
    return { ok: false as const, error: "This Google account is not authorized." };
  }

  return { ok: true as const, email };
}
