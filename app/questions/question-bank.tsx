"use client";

import { useCallback, useEffect, useState } from "react";
import { GoogleAuthProvider, onAuthStateChanged, signInWithPopup } from "firebase/auth";
import { LoaderCircle, LogIn, ShieldCheck } from "lucide-react";

import { loadLecturerQuestionBank } from "@/app/questions/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getFirebaseAuth, hasFirebaseConfig } from "@/lib/firebase";
import type { Question } from "@/lib/mock-data";

export function LecturerQuestionBank() {
  const [questions, setQuestions] = useState<Question[] | null>(null);
  const [lecturerEmail, setLecturerEmail] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const loadQuestions = useCallback(async (idToken: string) => {
    const response = await loadLecturerQuestionBank(idToken);
    if (!response.ok) {
      setQuestions(null);
      setError(response.error);
      return;
    }
    setQuestions(response.questions);
    setLecturerEmail(response.email);
    setError("");
  }, []);

  useEffect(() => {
    let active = true;
    let unsubscribe = () => {};

    if (hasFirebaseConfig()) {
      unsubscribe = onAuthStateChanged(getFirebaseAuth(), async (user) => {
        if (!active) return;
        if (!user || user.providerData.every((provider) => provider.providerId !== "google.com")) {
          setQuestions(null);
          setLecturerEmail("");
          setError("");
          setIsLoading(false);
          return;
        }

        setQuestions(null);
        setLecturerEmail("");
        setIsLoading(true);
        setError("");
        try {
          await loadQuestions(await user.getIdToken());
        } catch (loadError) {
          if (active) {
            setQuestions(null);
            setError(loadError instanceof Error ? loadError.message : "The question bank could not be loaded.");
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
  }, [loadQuestions]);

  async function signIn() {
    setIsLoading(true);
    setError("");
    try {
      const credential = await signInWithPopup(getFirebaseAuth(), new GoogleAuthProvider());
      await loadQuestions(await credential.user.getIdToken());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "The question bank could not be loaded.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-7xl space-y-6 p-6">
      <header className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.2em] text-blue-600">Question bank</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">Protected quiz content</h1>
          <CardDescription className="mt-2">Only verified lecturer accounts can view questions and answer keys.</CardDescription>
        </div>
        {!questions && (
          <Button onClick={signIn} disabled={isLoading}>
            {isLoading
              ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
              : <LogIn className="size-4" aria-hidden="true" />}
            Sign in with Google
          </Button>
        )}
      </header>

      {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</p>}

      {!questions ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="size-5 text-blue-700" aria-hidden="true" />
              Lecturer sign-in required
            </CardTitle>
            <CardDescription>Question content and answer keys are loaded from the server only after account verification.</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <>
          <p className="text-sm text-slate-600">Signed in as {lecturerEmail} · {questions.length} questions</p>
          <section className="grid gap-6 lg:grid-cols-2">
            {questions.map((question) => (
              <Card key={question.id}>
                <CardHeader>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <CardTitle className="text-xl">{question.question}</CardTitle>
                      <CardDescription className="mt-2">Type: {question.type} · {question.points} points</CardDescription>
                    </div>
                    <Badge>{question.difficulty}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {question.codeSnippet && (
                    <pre className="overflow-x-auto rounded-md bg-slate-950 p-3 text-sm text-slate-50">
                      <code>{question.codeSnippet}</code>
                    </pre>
                  )}
                  {question.type === "matching" ? (
                    <ul className="space-y-2 text-sm text-slate-600">
                      {question.matchItems?.map((item, index) => (
                        <li key={item} className="grid gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 sm:grid-cols-2">
                          <span>{item}</span>
                          <span>{question.answer[index]}</span>
                        </li>
                      ))}
                    </ul>
                  ) : question.options.length ? (
                    <ul className="space-y-2 text-sm text-slate-600">
                      {question.options.map((option, index) => (
                        <li key={`${option}-${index}`} className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">{option}</li>
                      ))}
                    </ul>
                  ) : null}
                  <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-900">
                    <p className="font-semibold">
                      Answer: {question.type === "matching"
                        ? question.matchItems?.map((item, index) => `${item} → ${question.answer[index]}`).join("; ")
                        : question.answer.join(question.type === "rearrange" ? "\n" : ", ")}
                    </p>
                    <p className="mt-1">{question.explanation}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {question.tags.map((tag) => <Badge key={tag} className="border-blue-200 bg-blue-50 text-blue-700">{tag}</Badge>)}
                  </div>
                </CardContent>
              </Card>
            ))}
          </section>
        </>
      )}
    </main>
  );
}
