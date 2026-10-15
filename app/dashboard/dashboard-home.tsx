"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { GoogleAuthProvider, onAuthStateChanged, signInWithPopup } from "firebase/auth";
import { ArrowRight, BookOpenCheck, ChartNoAxesCombined, ClipboardList, LoaderCircle, LogIn, Users } from "lucide-react";

import { getLecturerDashboard, type LecturerDashboardResponse } from "@/app/dashboard/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getFirebaseAuth, hasFirebaseConfig } from "@/lib/firebase";

type DashboardData = Extract<LecturerDashboardResponse, { ok: true }>;

function formatAverageScore(score: number | null) {
  return score === null ? "—" : `${score.toFixed(1)}%`;
}

export function DashboardHome() {
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function loadDashboard(idToken: string) {
    const response = await getLecturerDashboard(idToken);
    if (!response.ok) {
      setDashboard(null);
      setError(response.error);
      return;
    }
    setDashboard(response);
    setError("");
  }

  useEffect(() => {
    let active = true;
    let unsubscribe = () => {};
    if (hasFirebaseConfig()) {
      unsubscribe = onAuthStateChanged(getFirebaseAuth(), async (user) => {
        if (!active || !user || user.providerData.every((provider) => provider.providerId !== "google.com")) return;
        setIsLoading(true);
        try {
          await loadDashboard(await user.getIdToken());
        } catch (loadError) {
          if (active) setError(loadError instanceof Error ? loadError.message : "Dashboard data could not be loaded.");
        } finally {
          if (active) setIsLoading(false);
        }
      });
    }
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  async function signIn() {
    setIsLoading(true);
    setError("");
    try {
      const credential = await signInWithPopup(getFirebaseAuth(), new GoogleAuthProvider());
      await loadDashboard(await credential.user.getIdToken());
    } catch (signInError) {
      setError(signInError instanceof Error ? signInError.message : "Lecturer sign-in failed.");
    } finally {
      setIsLoading(false);
    }
  }

  if (!dashboard) {
    return (
      <main className="mx-auto flex min-h-[80vh] max-w-5xl flex-col justify-center gap-8 p-6">
        <header className="max-w-3xl space-y-3">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-blue-700">Eduvos</p>
          <h1 className="text-4xl font-bold tracking-tight text-slate-950 sm:text-5xl">Class quizzes, made simple</h1>
          <p className="text-lg text-slate-600">
            Join a quiz as a student, or sign in as a lecturer to manage quizzes and review results.
          </p>
        </header>

        {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</p>}

        <section className="grid gap-5 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Users className="size-5 text-blue-700" aria-hidden="true" /> I&apos;m a student</CardTitle>
              <CardDescription>No Google sign-in or registered account needed.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-slate-600">Enter your lecturer&apos;s room code. The app creates an anonymous session for your quiz attempt.</p>
              <Button asChild><Link href="/join">Join a quiz <ArrowRight className="size-4" /></Link></Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><BookOpenCheck className="size-5 text-emerald-700" aria-hidden="true" /> I&apos;m a lecturer</CardTitle>
              <CardDescription>Lecturer tools require an authorized Google account.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-slate-600">View quiz activity and manage assessments from your lecturer dashboard.</p>
              <Button onClick={signIn} disabled={isLoading}>
                {isLoading ? <LoaderCircle className="size-4 animate-spin" /> : <LogIn className="size-4" />}
                Sign in with Google
              </Button>
            </CardContent>
          </Card>
        </section>
      </main>
    );
  }

  const statCards = [
    { label: "Total quizzes", value: dashboard.stats.totalQuizzes, detail: "All drafts and sessions", icon: ClipboardList, color: "text-blue-700 bg-blue-50" },
    { label: "Published now", value: dashboard.stats.publishedQuizzes, detail: "Accepting student joins", icon: BookOpenCheck, color: "text-emerald-700 bg-emerald-50" },
    { label: "Student submissions", value: dashboard.stats.totalSubmissions, detail: "Across all quizzes", icon: Users, color: "text-violet-700 bg-violet-50" },
    { label: "Average score", value: formatAverageScore(dashboard.stats.averageScore), detail: "Across scored submissions", icon: ChartNoAxesCombined, color: "text-amber-700 bg-amber-50" },
  ];

  return (
    <main className="mx-auto max-w-7xl space-y-8 p-6">
      <header className="flex flex-col justify-between gap-4 rounded-2xl bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 p-7 text-white shadow-sm sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-blue-200">Lecturer dashboard</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">Welcome back</h1>
          <p className="mt-2 text-sm text-slate-300">Signed in as {dashboard.email}. Here&apos;s your quiz activity at a glance.</p>
        </div>
        <Button asChild variant="secondary"><Link href="/quizzes">Manage quizzes <ArrowRight className="size-4" /></Link></Button>
      </header>

      <section aria-label="Quiz overview statistics" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {statCards.map(({ label, value, detail, icon: Icon, color }) => (
          <Card key={label} className="overflow-hidden">
            <CardHeader className="flex-row items-start justify-between space-y-0 pb-2">
              <div>
                <CardDescription>{label}</CardDescription>
                <CardTitle className="mt-2 text-3xl">{value}</CardTitle>
              </div>
              <span className={`rounded-xl p-2.5 ${color}`}><Icon className="size-5" aria-hidden="true" /></span>
            </CardHeader>
            <CardContent><p className="text-xs text-slate-500">{detail}</p></CardContent>
          </Card>
        ))}
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.4fr_0.8fr]">
        <Card>
          <CardHeader className="flex-row items-start justify-between gap-3">
            <div><CardTitle>Recent quizzes</CardTitle><CardDescription>Your most recently updated quiz drafts and sessions.</CardDescription></div>
            <Button asChild size="sm" variant="outline"><Link href="/quizzes">View all</Link></Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {dashboard.recentQuizzes.length ? dashboard.recentQuizzes.map((quiz) => (
              <div key={quiz.id} className="flex flex-col gap-2 rounded-xl border border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-semibold text-slate-900">{quiz.title}</p>
                  <p className="mt-1 text-sm text-slate-500">Room {quiz.roomCode} · {quiz.questionCount} questions</p>
                </div>
                <Badge>{quiz.status}</Badge>
              </div>
            )) : (
              <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center">
                <p className="font-medium text-slate-800">No quizzes yet</p>
                <p className="mt-1 text-sm text-slate-500">Create a quiz or import a JSON quiz to get started.</p>
                <Button asChild className="mt-4"><Link href="/quizzes">Create a quiz</Link></Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>At a glance</CardTitle><CardDescription>A quick snapshot of your assessment setup.</CardDescription></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between rounded-lg bg-slate-50 p-4">
              <span className="text-sm text-slate-600">Drafts to finish</span><strong className="text-lg">{dashboard.stats.draftQuizzes}</strong>
            </div>
            <div className="rounded-lg border border-blue-100 bg-blue-50 p-4 text-sm text-blue-950">
              Student access remains anonymous. Share a published quiz&apos;s room code with your class.
            </div>
            <Button asChild variant="outline" className="w-full"><Link href="/results">Review student results <ArrowRight className="size-4" /></Link></Button>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
