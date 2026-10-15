"use server";

import { z } from "zod";

import { getFirebaseAdminFirestore } from "@/lib/firebase-admin";
import { verifyLecturerIdToken } from "@/lib/lecturer-auth";
import { parseQuiz } from "@/lib/quiz-store";

const submissionSchema = z.object({
  score: z.number().nullable().optional(),
  maxScore: z.number().nullable().optional(),
});

export type LecturerDashboardResponse =
  | {
      ok: true;
      email: string;
      stats: {
        totalQuizzes: number;
        publishedQuizzes: number;
        draftQuizzes: number;
        totalSubmissions: number;
        averageScore: number | null;
      };
      recentQuizzes: Array<{
        id: string;
        title: string;
        status: string;
        roomCode: string;
        questionCount: number;
        updatedAt: string;
      }>;
    }
  | { ok: false; error: string };

export async function getLecturerDashboard(rawIdToken: unknown): Promise<LecturerDashboardResponse> {
  const authorization = await verifyLecturerIdToken(rawIdToken);
  if (!authorization.ok) return authorization;

  const quizSnapshots = await getFirebaseAdminFirestore().collection("quizzes").get();
  const quizzes = quizSnapshots.docs.map((document) => ({
    quiz: parseQuiz(document.id, document.data()),
  }));

  const submissionSnapshots = await Promise.all(quizzes.map(({ quiz }) =>
    getFirebaseAdminFirestore().collection("quizzes").doc(quiz.id).collection("submissions").get(),
  ));

  let totalSubmissions = 0;
  let scoredAttempts = 0;
  let scorePercentTotal = 0;
  submissionSnapshots.forEach((snapshot) => {
    totalSubmissions += snapshot.size;
    snapshot.docs.forEach((document) => {
      const parsed = submissionSchema.safeParse(document.data());
      if (!parsed.success) {
        throw new Error(`Stored submission "${document.id}" has an invalid score format.`);
      }
      const { score, maxScore } = parsed.data;
      if (score !== null && score !== undefined && maxScore !== null && maxScore !== undefined && maxScore > 0) {
        scorePercentTotal += (score / maxScore) * 100;
        scoredAttempts += 1;
      }
    });
  });

  const recentQuizzes = quizzes
    .map(({ quiz }) => ({
      id: quiz.id,
      title: quiz.title,
      status: quiz.status,
      roomCode: quiz.roomCode,
      questionCount: quiz.questionIds.length,
      updatedAt: quiz.updatedAt,
    }))
    .sort((first, second) => second.updatedAt.localeCompare(first.updatedAt))
    .slice(0, 5);

  return {
    ok: true,
    email: authorization.email,
    stats: {
      totalQuizzes: quizzes.length,
      publishedQuizzes: quizzes.filter(({ quiz }) => quiz.status === "published").length,
      draftQuizzes: quizzes.filter(({ quiz }) => quiz.status === "draft").length,
      totalSubmissions,
      averageScore: scoredAttempts > 0 ? scorePercentTotal / scoredAttempts : null,
    },
    recentQuizzes,
  };
}
