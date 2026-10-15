"use server";

import { Timestamp } from "firebase-admin/firestore";
import { z } from "zod";

import { getFirebaseAdminFirestore } from "@/lib/firebase-admin";
import { verifyLecturerIdToken } from "@/lib/lecturer-auth";
import { buildQuizResults, type StoredQuizSubmission } from "@/lib/results";
import { getPublishedQuizzesWithQuestions } from "@/lib/quiz-store";

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

export async function getLecturerResults(rawIdToken: unknown): Promise<LecturerResultsResponse> {
  const authorization = await verifyLecturerIdToken(rawIdToken);
  if (!authorization.ok) {
    return authorization;
  }

  const firestore = getFirebaseAdminFirestore();
  const publishedQuizzes = await getPublishedQuizzesWithQuestions();
  const results = await Promise.all(publishedQuizzes.map(async ({ quiz, questions }) => {
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

    return buildQuizResults(quiz, submissions, questions, quiz.roomCode);
  }));

  return { ok: true, email: authorization.email, quizzes: results };
}
