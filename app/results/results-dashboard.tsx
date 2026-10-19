"use client";

import { useCallback, useEffect, useState } from "react";
import { Download, LoaderCircle, LogIn, LogOut, ShieldCheck } from "lucide-react";
import { GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut } from "firebase/auth";

import { getLecturerResults } from "@/app/results/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getFirebaseAuth, hasFirebaseConfig } from "@/lib/firebase";
import { exportResultsCsv, type QuizResults } from "@/lib/results";

type DashboardData = {
  email: string;
  quizzes: QuizResults[];
};

function percentage(value: number | null) {
  return value === null ? "—" : `${value.toFixed(1)}%`;
}

export function ResultsDashboard() {
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const loadResults = useCallback(async (idToken: string) => {
    const response = await getLecturerResults(idToken);
    if (!response.ok) {
      setDashboard(null);
      setError(response.error);
      return;
    }

    setDashboard({ email: response.email, quizzes: response.quizzes });
    setError("");
  }, []);

  useEffect(() => {
    let active = true;
    let unsubscribe = () => {};

    if (hasFirebaseConfig()) {
      unsubscribe = onAuthStateChanged(getFirebaseAuth(), async (user) => {
        if (!active) return;
        if (!user || user.providerData.every((provider) => provider.providerId !== "google.com")) {
          setDashboard(null);
          setError("");
          setIsLoading(false);
          return;
        }

        setDashboard(null);
        setIsLoading(true);
        setError("");
        try {
          await loadResults(await user.getIdToken());
        } catch (loadError) {
          if (active) {
            setDashboard(null);
            setError(loadError instanceof Error ? loadError.message : "Results could not be loaded.");
          }
        } finally {
          if (active) setIsLoading(false);
        }
      });
    }

    return () => {
      active = false;
      unsubscribe();
    };
  }, [loadResults]);

  async function signIn() {
    setIsLoading(true);
    setError("");
    try {
      const credential = await signInWithPopup(getFirebaseAuth(), new GoogleAuthProvider());
      await loadResults(await credential.user.getIdToken());
    } catch (signInError) {
      setDashboard(null);
      setError(signInError instanceof Error ? signInError.message : "Sign-in or results loading failed.");
    } finally {
      setIsLoading(false);
    }
  }

  async function signOutLecturer() {
    setIsLoading(true);
    setError("");
    try {
      await signOut(getFirebaseAuth());
      setDashboard(null);
    } catch (signOutError) {
      setError(signOutError instanceof Error ? signOutError.message : "Sign-out failed.");
    } finally {
      setIsLoading(false);
    }
  }

  function downloadCsv() {
    if (!dashboard) return;

    const csv = exportResultsCsv(dashboard.quizzes);
    if (!csv) {
      setError("There are no submissions to export yet.");
      return;
    }

    const file = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const downloadUrl = URL.createObjectURL(file);
    const link = document.createElement("a");
    link.href = downloadUrl;
    link.download = "quiz-results.csv";
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
  }

  return (
    <main className="mx-auto max-w-7xl space-y-6 p-6">
      <header className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.2em] text-blue-600">Lecturer results</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">Quiz submissions</h1>
          <CardDescription className="mt-2">
            Private results and response review for published quizzes.
          </CardDescription>
        </div>
        {dashboard ? (
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={downloadCsv} disabled={isLoading}>
              <Download className="size-4" aria-hidden="true" />
              Export CSV
            </Button>
            <Button variant="secondary" onClick={signOutLecturer} disabled={isLoading}>
              <LogOut className="size-4" aria-hidden="true" />
              Sign out
            </Button>
          </div>
        ) : (
          <Button onClick={signIn} disabled={isLoading}>
            {isLoading
              ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
              : <LogIn className="size-4" aria-hidden="true" />}
            Sign in with Google
          </Button>
        )}
      </header>

      {error && (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {error}
        </p>
      )}

      {!dashboard ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="size-5 text-blue-700" aria-hidden="true" />
              Lecturer sign-in required
            </CardTitle>
            <CardDescription>
              Results are only returned to verified Google accounts on the lecturer allowlist.
              Student browsers cannot read Firestore submissions directly.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <>
          <p className="text-sm text-slate-600">Signed in as {dashboard.email}</p>
          {dashboard.quizzes.map((quiz) => (
            <section key={quiz.id} className="space-y-4">
              <Card>
                <CardHeader>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <CardTitle>{quiz.title}</CardTitle>
                      <CardDescription className="mt-1">{quiz.description}</CardDescription>
                    </div>
                    {quiz.roomCode && <Badge>Room {quiz.roomCode}</Badge>}
                  </div>
                </CardHeader>
                <CardContent className="grid gap-4 sm:grid-cols-3">
                  <div>
                    <p className="text-sm text-slate-500">Submissions</p>
                    <p className="text-2xl font-semibold">{quiz.submissionCount}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">Average score</p>
                    <p className="text-2xl font-semibold">{percentage(quiz.averagePercent)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">Pass rate</p>
                    <p className="text-2xl font-semibold">{percentage(quiz.passPercentage)}</p>
                    <p className="text-xs text-slate-500">
                      {quiz.passMark === null
                        ? "Set a pass mark to calculate"
                        : `${quiz.passCount} of ${quiz.gradedCount} graded submissions passed · Pass mark: ${quiz.passMark}%`}
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Per-question performance</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {quiz.questionStats.map((question, index) => (
                    <div key={question.id} className="space-y-2">
                      <div className="flex items-start justify-between gap-4 text-sm">
                        <span className="font-medium text-slate-800">
                          {index + 1}. {question.question}
                        </span>
                        <span className="shrink-0 text-slate-600">
                          {question.correctCount}/{question.responseCount} ({percentage(question.percentCorrect)})
                        </span>
                      </div>
                      <div
                        className="h-2.5 w-full overflow-hidden rounded-full bg-slate-200"
                        role="progressbar"
                        aria-label={`Correct responses for question ${index + 1}`}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={question.percentCorrect ?? 0}
                      >
                        <div
                          className="h-full rounded-full bg-blue-600"
                          style={{ width: `${question.percentCorrect ?? 0}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Participants and responses</CardTitle>
                  <CardDescription>Expand a participant to review their answer to each question.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {quiz.submissions.length === 0 ? (
                    <p className="text-sm text-slate-600">No submissions have been received for this quiz.</p>
                  ) : quiz.submissions.map((submission) => (
                    <details key={submission.id} className="rounded-lg border border-slate-200 p-4">
                      <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-3">
                        <span className="font-medium">{submission.displayName || "Anonymous participant"}</span>
                        <span className="flex flex-wrap items-center gap-3 text-sm text-slate-600">
                          <span>{submission.submittedAt ? new Date(submission.submittedAt).toLocaleString() : "Time unavailable"}</span>
                          <span>
                            {submission.score === null || submission.maxScore === null
                              ? "Score unavailable"
                              : `${submission.score}/${submission.maxScore} (${percentage(submission.percent)})`}
                          </span>
                          {submission.passed !== null && (
                            <Badge className={submission.passed ? "border-green-200 bg-green-50 text-green-800" : "border-amber-200 bg-amber-50 text-amber-800"}>
                              {submission.passed ? "Passed" : "Not passed"}
                            </Badge>
                          )}
                        </span>
                      </summary>
                      <div className="mt-4 space-y-4 border-t border-slate-100 pt-4">
                        {submission.questions.map((question, index) => (
                          <div key={question.id} className="space-y-1 text-sm">
                            <p className="font-medium">{index + 1}. {question.question}</p>
                            <p className="text-slate-600">
                              Answer: {question.matchItems
                                ? question.matchItems.map((item, itemIndex) => `${item} → ${question.selectedAnswers[itemIndex] || "No match"}`).join("; ")
                                : question.selectedAnswers.length ? question.selectedAnswers.join(", ") : "No answer"}
                            </p>
                            <p className={question.isCorrect ? "text-green-700" : "text-red-700"}>
                              {question.isCorrect ? "Correct" : "Incorrect"} · {question.earnedPoints}/{question.possiblePoints} points
                            </p>
                          </div>
                        ))}
                      </div>
                    </details>
                  ))}
                </CardContent>
              </Card>
            </section>
          ))}
        </>
      )}
    </main>
  );
}
