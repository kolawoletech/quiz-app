"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { CheckCircle2, Clock3, LoaderCircle, XCircle } from "lucide-react";
import { signInAnonymously } from "firebase/auth";

import { loadStudentSession, submitStudentQuiz } from "@/app/join/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getStudentFirebaseAuth } from "@/lib/firebase";
import type {
  LoadStudentSessionResult,
  StudentQuestionResult,
  StudentSession,
  StudentSubmissionResult,
} from "@/lib/student-quiz";

function shuffle<T>(values: T[]) {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

function formatTime(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
}

export function StudentSessionForm() {
  const [session, setSession] = useState<StudentSession | null>(null);
  const [roomCode, setRoomCode] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [result, setResult] = useState<StudentSubmissionResult | null>(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);
  const submissionStarted = useRef(false);
  const attemptId = useRef("");

  const submitAnswers = useCallback(async (currentAnswers: Record<string, string[]>) => {
    if (!session || submissionStarted.current) return;

    submissionStarted.current = true;
    setIsSubmitting(true);
    setError("");
    try {
      const auth = getStudentFirebaseAuth();
      const user = auth.currentUser ?? (await signInAnonymously(auth)).user;
      const submissionResult = await submitStudentQuiz({
        roomCode: session.roomCode,
        answers: currentAnswers,
        displayName: displayName.trim(),
        attemptId: attemptId.current || (attemptId.current = crypto.randomUUID()),
        idToken: await user.getIdToken(),
      });
      setResult(submissionResult);
    } catch (submissionError) {
      submissionStarted.current = false;
      setError(submissionError instanceof Error ? submissionError.message : "Your answers could not be submitted.");
    } finally {
      setIsSubmitting(false);
    }
  }, [displayName, session]);

  useEffect(() => {
    if (!session?.settings.timeLimitMinutes || result) return;

    const timer = window.setInterval(() => {
      setRemainingSeconds((seconds) => {
        if (seconds === null || seconds <= 1) {
          window.clearInterval(timer);
          return 0;
        }
        return seconds - 1;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [session, result]);

  useEffect(() => {
    if (remainingSeconds === 0 && !result && !submissionStarted.current) {
      void submitAnswers(answers);
    }
  }, [remainingSeconds, result, answers, submitAnswers]);

  async function joinSession(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      const auth = getStudentFirebaseAuth();
      const user = auth.currentUser ?? (await signInAnonymously(auth)).user;
      const response: LoadStudentSessionResult = await loadStudentSession(roomCode, await user.getIdToken());
      if (!response.ok) {
        setError(response.error);
        return;
      }

      const loadedSession = response.session;
      const questions = loadedSession.settings.shuffleQuestions
        ? shuffle(loadedSession.questions)
        : loadedSession.questions;
      const shuffledSession = {
        ...loadedSession,
        questions: questions.map((question) => ({
          ...question,
          options: loadedSession.settings.shuffleOptions ? shuffle(question.options) : question.options,
        })),
      };
      setSession(shuffledSession);
      setAnswers({});
      setResult(null);
      submissionStarted.current = false;
      attemptId.current = "";
      setRemainingSeconds(
        shuffledSession.settings.timeLimitMinutes
          ? shuffledSession.settings.timeLimitMinutes * 60
          : null,
      );
    } catch (joinError) {
      setError(joinError instanceof Error ? joinError.message : "The session could not be loaded.");
    } finally {
      setIsLoading(false);
    }
  }

  function updateAnswer(questionId: string, value: string, checked = true) {
    setAnswers((current) => {
      const selected = current[questionId] ?? [];
      const question = session?.questions.find((item) => item.id === questionId);
      const next = question && (question.type === "single" || question.type === "truefalse")
        ? checked ? [value] : []
        : checked
          ? [...new Set([...selected, value])]
          : selected.filter((answer) => answer !== value);
      return { ...current, [questionId]: next };
    });
  }

  function hasAnsweredEveryQuestion() {
    return session?.questions.every((question) => (answers[question.id] ?? []).some((answer) => answer.trim())) ?? false;
  }

  if (!session) {
    return (
      <main className="mx-auto flex min-h-[80vh] max-w-4xl items-center justify-center p-6">
        <Card className="w-full max-w-lg">
          <CardHeader>
            <CardTitle>Join a class session</CardTitle>
            <CardDescription>Enter the room code provided by your lecturer. A secure anonymous session is created automatically.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={joinSession} className="space-y-5">
              <div className="space-y-2">
                <label htmlFor="room-code" className="text-sm font-medium text-slate-700">Room code</label>
                <Input
                  id="room-code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={4}
                  pattern="[0-9]{4}"
                  placeholder="e.g. 8341"
                  value={roomCode}
                  onChange={(event) => setRoomCode(event.target.value.replace(/\D/g, "").slice(0, 4))}
                  className="text-center text-2xl tracking-[0.3em]"
                  required
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="display-name" className="text-sm font-medium text-slate-700">Display name (optional)</label>
                <Input
                  id="display-name"
                  autoComplete="nickname"
                  maxLength={40}
                  placeholder="Anonymous participant"
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                />
              </div>
              {error && <p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p>}
              <Button className="w-full" type="submit" disabled={isLoading || roomCode.length !== 4}>
                {isLoading && <LoaderCircle className="h-4 w-4 animate-spin" />}
                {isLoading ? "Checking room..." : "Join session"}
              </Button>
              <p className="text-center text-xs text-slate-500">
                Your anonymous participant session is used to enforce the quiz attempt limit.
              </p>
            </form>
          </CardContent>
        </Card>
      </main>
    );
  }

  const answeredCount = session.questions.filter((question) =>
    (answers[question.id] ?? []).some((answer) => answer.trim()),
  ).length;

  if (result) {
    return (
      <main className="mx-auto max-w-4xl space-y-6 p-6">
        <Card>
          <CardHeader>
            <Badge className="w-fit">Room {session.roomCode}</Badge>
            <Badge className="w-fit">
              {Math.max(0, session.attemptsRemaining - 1)} of {session.attemptLimit} attempts remaining
            </Badge>
            <CardTitle className="text-2xl">{session.title}</CardTitle>
            <CardDescription>Submitted as {displayName.trim() || "Anonymous participant"}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {result.score !== null && result.maxScore !== null ? (
              <div className="rounded-xl bg-slate-50 p-6 text-center">
                <p className="text-sm text-slate-500">Your score</p>
                <p className="mt-1 text-4xl font-bold">{result.score} <span className="text-2xl text-slate-400">/ {result.maxScore}</span></p>
                {session.settings.passMark !== undefined && (
                  <Badge className="mt-3">
                    {result.score / result.maxScore * 100 >= session.settings.passMark ? "Passed" : "Not passed"}
                    {" · "}
                    Pass mark: {session.settings.passMark}%
                  </Badge>
                )}
              </div>
            ) : (
              <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-700">
                Your response was submitted. Results are hidden by this quiz&apos;s settings.
              </p>
            )}
            {result.questionResults ? (
              <div className="space-y-3">
                {result.questionResults.map((questionResult: StudentQuestionResult, index) => {
                  const question = session.questions.find((item) => item.id === questionResult.questionId);
                  return (
                    <div key={questionResult.questionId} className="rounded-lg border border-slate-200 p-4">
                      <div className="flex items-start gap-3">
                        {questionResult.isCorrect
                          ? <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-600" />
                          : <XCircle className="mt-0.5 h-5 w-5 text-red-600" />}
                        <div className="space-y-1">
                          <p className="font-medium">{index + 1}. {question?.question}</p>
                          <p className="text-sm text-slate-600">
                            Correct answer: {questionResult.correctAnswer}
                          </p>
                          {questionResult.explanation && <p className="text-sm text-slate-500">{questionResult.explanation}</p>}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-slate-500">Answer review is disabled for this quiz.</p>
            )}
            <Button variant="outline" onClick={() => window.location.reload()}>Join another session</Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-4xl space-y-6 p-6">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <Badge className="mb-3">Room {session.roomCode}</Badge>
              <CardTitle className="text-2xl">{session.title}</CardTitle>
              <CardDescription className="mt-1">{session.description}</CardDescription>
            </div>
            {remainingSeconds !== null && (
              <Badge className="flex items-center gap-2">
                <Clock3 className="h-4 w-4" />
                {formatTime(remainingSeconds)} remaining
              </Badge>
            )}
            <Badge>{session.attemptsRemaining} attempt{session.attemptsRemaining === 1 ? "" : "s"} available</Badge>
          </div>
          <p className="text-sm text-slate-500">
            {answeredCount} of {session.questions.length} answered
            {displayName.trim() && ` · ${displayName.trim()}`}
          </p>
        </CardHeader>
      </Card>

      {session.questions.map((question, index) => {
        const selected = answers[question.id] ?? [];
        const isChoiceQuestion = question.type === "single" || question.type === "truefalse";
        return (
          <Card key={question.id}>
            <CardHeader>
              <CardTitle className="text-lg">
                {index + 1}. {question.question}
              </CardTitle>
              {question.codeSnippet && (
                <pre className="overflow-x-auto rounded-lg bg-slate-950 p-4 text-sm text-slate-100">
                  <code>{question.codeSnippet}</code>
                </pre>
              )}
              <CardDescription>{question.points} {question.points === 1 ? "point" : "points"}</CardDescription>
            </CardHeader>
            <CardContent>
              {question.options.length ? (
                <div className="space-y-2">
                  {question.options.map((option) => (
                    <label key={option} className="flex cursor-pointer items-center gap-3 rounded-lg border border-slate-200 p-3 hover:bg-slate-50">
                      <input
                        type={isChoiceQuestion ? "radio" : "checkbox"}
                        name={`question-${question.id}`}
                        value={option}
                        checked={selected.includes(option)}
                        onChange={(event) => updateAnswer(question.id, option, event.target.checked)}
                        disabled={isSubmitting}
                        className="h-4 w-4 accent-slate-900"
                      />
                      <span className="text-sm">{option}</span>
                    </label>
                  ))}
                </div>
              ) : (
                <textarea
                  value={selected[0] ?? ""}
                  onChange={(event) => setAnswers((current) => ({ ...current, [question.id]: [event.target.value] }))}
                  rows={question.type === "code" ? 6 : 3}
                  disabled={isSubmitting}
                  aria-label={`Answer to question ${index + 1}`}
                  placeholder="Type your answer"
                  className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 font-mono text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
                />
              )}
            </CardContent>
          </Card>
        );
      })}

      {error && <p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <div className="flex flex-col items-start justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center">
        <p className="text-sm text-slate-500">
          Your answers and score will be saved with an anonymous participant ID
          {displayName.trim() ? " and your display name" : ""}.
        </p>
        <Button
          onClick={() => void submitAnswers(answers)}
          disabled={isSubmitting || !hasAnsweredEveryQuestion()}
        >
          {isSubmitting && <LoaderCircle className="h-4 w-4 animate-spin" />}
          {isSubmitting ? "Submitting…" : "Submit answers"}
        </Button>
      </div>
    </main>
  );
}
