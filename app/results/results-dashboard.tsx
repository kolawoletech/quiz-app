"use client";

import { useCallback, useEffect, useState } from "react";
import { BarChart3, CheckCircle2, Download, LoaderCircle, LogIn, LogOut, ShieldCheck, Users } from "lucide-react";
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

function performanceColor(value: number | null) {
  if (value === null) return "bg-slate-300";
  if (value >= 70) return "bg-emerald-500";
  if (value >= 40) return "bg-amber-500";
  return "bg-rose-500";
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
    <main className="mx-auto max-w-7xl space-y-8 p-4 sm:p-6">
      <header className="overflow-hidden rounded-2xl bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 p-6 text-white shadow-sm sm:p-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-blue-200">Lecturer workspace</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Results &amp; performance</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-300">
            Track quiz outcomes, see which questions need attention, and review student responses.
          </p>
        </div>
        {dashboard ? (
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" onClick={downloadCsv} disabled={isLoading}>
              <Download className="size-4" aria-hidden="true" />
              Export CSV
            </Button>
            <Button className="border border-white/20 bg-white/10 text-white hover:bg-white/20" onClick={signOutLecturer} disabled={isLoading}>
              <LogOut className="size-4" aria-hidden="true" />
              Sign out
            </Button>
          </div>
        ) : (
          <Button onClick={signIn} disabled={isLoading}>
            {isLoading
              ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
              : <LogIn className="size-4" aria-hidden="true" />}
            {isLoading ? "Loading results..." : "Sign in with Google"}
          </Button>
        )}
        </div>
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
              {isLoading
                ? <LoaderCircle className="size-5 animate-spin text-blue-700" aria-hidden="true" />
                : <ShieldCheck className="size-5 text-blue-700" aria-hidden="true" />}
              {isLoading ? "Loading lecturer results" : "Lecturer sign-in required"}
            </CardTitle>
            <CardDescription>
              {isLoading
                ? "Restoring your sign-in and loading quiz performance."
                : "Results are only returned to verified Google accounts on the lecturer allowlist. Student browsers cannot read Firestore submissions directly."}
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <>
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-slate-600">Signed in as <span className="font-medium text-slate-900">{dashboard.email}</span></p>
            <p className="text-sm text-slate-500">
              {dashboard.quizzes.length} {dashboard.quizzes.length === 1 ? "quiz" : "quizzes"} with results
            </p>
          </div>
          {dashboard.quizzes.length === 0 && (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center py-12 text-center">
                <BarChart3 className="size-10 text-slate-400" aria-hidden="true" />
                <h2 className="mt-4 font-semibold text-slate-900">No quiz results yet</h2>
                <p className="mt-1 max-w-md text-sm text-slate-500">Published quizzes and their submissions will appear here when students complete them.</p>
              </CardContent>
            </Card>
          )}
          {dashboard.quizzes.map((quiz) => (
            <section key={quiz.id} className="space-y-5">
              <Card className="overflow-hidden">
                <CardHeader className="border-b border-slate-100 bg-white sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <CardTitle className="text-xl">{quiz.title}</CardTitle>
                      {quiz.roomCode && <Badge className="border-blue-200 bg-blue-50 text-blue-800">Room {quiz.roomCode}</Badge>}
                    </div>
                    {quiz.description && <CardDescription>{quiz.description}</CardDescription>}
                  </div>
                </CardHeader>
                <CardContent className="grid gap-3 bg-slate-50/70 p-4 sm:grid-cols-3 sm:p-5">
                  <div className="rounded-xl border border-slate-200 bg-white p-4">
                    <div className="flex items-center gap-2 text-sm text-slate-500"><Users className="size-4" aria-hidden="true" /> Submissions</div>
                    <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">{quiz.submissionCount}</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white p-4">
                    <div className="flex items-center gap-2 text-sm text-slate-500"><BarChart3 className="size-4" aria-hidden="true" /> Average score</div>
                    <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">{percentage(quiz.averagePercent)}</p>
                    <p className="mt-1 text-xs text-slate-500">Across {quiz.gradedCount} graded submissions</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white p-4">
                    <div className="flex items-center gap-2 text-sm text-slate-500"><CheckCircle2 className="size-4" aria-hidden="true" /> Pass rate</div>
                    <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">{percentage(quiz.passPercentage)}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {quiz.passMark === null
                        ? "Set a pass mark to calculate"
                        : `${quiz.passCount} of ${quiz.gradedCount} passed · Pass mark: ${quiz.passMark}%`}
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="border-b border-slate-100 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2"><BarChart3 className="size-5 text-blue-700" aria-hidden="true" /> Question performance</CardTitle>
                    <CardDescription className="mt-2">Average points earned per question, including partial credit.</CardDescription>
                  </div>
                  <p className="text-xs text-slate-500">{quiz.questionStats.length} questions</p>
                </CardHeader>
                <CardContent className="p-4 sm:p-6">
                  {quiz.submissionCount === 0 ? (
                    <p className="rounded-lg bg-slate-50 p-5 text-sm text-slate-600">Question performance will appear after students submit this quiz.</p>
                  ) : (
                    <div className="grid gap-3 lg:grid-cols-2">
                      {quiz.questionStats.map((question, index) => (
                        <article key={question.id} className="rounded-xl border border-slate-200 bg-white p-4 transition hover:border-slate-300 hover:shadow-sm">
                          <div className="flex items-start gap-3">
                            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-xs font-semibold text-slate-600">
                              {String(index + 1).padStart(2, "0")}
                            </span>
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
                                <p className="text-sm font-medium leading-5 text-slate-800">{question.question}</p>
                                <span className="shrink-0 text-sm font-semibold tabular-nums text-slate-900">{percentage(question.averageScorePercent)}</span>
                              </div>
                              <div
                                className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100"
                                role="progressbar"
                                aria-label={`Average score for question ${index + 1}`}
                                aria-valuemin={0}
                                aria-valuemax={100}
                                aria-valuenow={question.averageScorePercent ?? 0}
                              >
                                <div
                                  className={`h-full rounded-full transition-[width] ${performanceColor(question.averageScorePercent)}`}
                                  style={{ width: `${question.averageScorePercent ?? 0}%` }}
                                />
                              </div>
                              <p className="mt-2 text-xs text-slate-500">
                                {question.correctCount} of {question.responseCount} fully correct
                              </p>
                            </div>
                          </div>
                        </article>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="border-b border-slate-100">
                  <CardTitle>Participants and responses</CardTitle>
                  <CardDescription>Expand a participant to review their answers and points by question.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 p-4 sm:p-6">
                  {quiz.submissions.length === 0 ? (
                    <p className="rounded-lg bg-slate-50 p-5 text-sm text-slate-600">No submissions have been received for this quiz.</p>
                  ) : quiz.submissions.map((submission) => (
                    <details key={submission.id} className="group rounded-xl border border-slate-200 bg-white transition open:border-slate-300 open:shadow-sm">
                      <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3 p-4 [&::-webkit-details-marker]:hidden">
                        <span className="font-medium text-slate-900">{submission.displayName || "Anonymous participant"}</span>
                        <span className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
                          <span>{submission.submittedAt ? new Date(submission.submittedAt).toLocaleString() : "Time unavailable"}</span>
                          <span className="rounded-md bg-slate-100 px-2 py-1 font-medium text-slate-800">
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
                      <div className="space-y-3 border-t border-slate-100 bg-slate-50/60 p-4 sm:p-5">
                        {submission.questions.map((question, index) => (
                          <div key={question.id} className="rounded-lg border border-slate-200 bg-white p-4">
                            <div className="flex items-start gap-3">
                              <span className={`mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full ${question.isCorrect ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>
                                {question.isCorrect ? <CheckCircle2 className="size-4" aria-hidden="true" /> : <span className="text-xs font-bold">×</span>}
                              </span>
                              <div className="min-w-0 flex-1 space-y-2">
                                <p className="text-sm font-medium text-slate-900">{index + 1}. {question.question}</p>
                                <p className="text-sm text-slate-600">
                                  Answer: {question.matchItems
                                    ? question.matchItems.map((item, itemIndex) => `${item} → ${question.selectedAnswers[itemIndex] || "No match"}`).join("; ")
                                    : question.selectedAnswers.length ? question.selectedAnswers.join(", ") : "No answer"}
                                </p>
                                <p className={`text-xs font-medium ${question.isCorrect ? "text-emerald-700" : "text-slate-500"}`}>
                                  {question.isCorrect ? "Fully correct" : "Points earned"} · {question.earnedPoints}/{question.possiblePoints} points
                                </p>
                              </div>
                            </div>
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
