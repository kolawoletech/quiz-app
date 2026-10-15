"use server";

import { verifyLecturerIdToken } from "@/lib/lecturer-auth";

export async function verifyLecturerNavigation(rawIdToken: unknown) {
  return verifyLecturerIdToken(rawIdToken);
}
