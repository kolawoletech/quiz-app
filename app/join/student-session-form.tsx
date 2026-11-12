"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowDown, ArrowUp, CheckCircle2, Clock3, GripVertical, LoaderCircle, XCircle } from "lucide-react";
import { signInAnonymously } from "firebase/auth";

import { loadStudentAnswerReview, loadStudentSession, submitStudentQuiz } from "@/app/join/actions";
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
  if (minutes >= 60) {
    return `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`;
  }
  return `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
}

export function StudentSessionForm() {
  const [session, setSession] = useState<StudentSession | null>(null);
  const [roomCode, setRoomCode] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [result, setResult] = useState<StudentSubmissionResult | null>(null);
  const [error, setError] = useState("");
  const [reviewMessage, setReviewMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCheckingReview, setIsCheckingReview] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);
  const [deadlineAt, setDeadlineAt] = useState<number | null>(null);
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
      setSession((current) => current && ({
        ...current,
        attemptsUsed: current.attemptsUsed + 1,
        attemptsRemaining: Math.max(0, current.attemptsRemaining - 1),
        canAttempt: current.attemptsRemaining > 1,
      }));
      setResult(submissionResult);
    } catch (submissionError) {
      submissionStarted.current = false;
      setError(submissionError instanceof Error ? submissionError.message : "Your answers could not be submitted.");
    } finally {
      setIsSubmitting(false);
    }
  }, [displayName, session]);

  async function checkAnswerReview() {
    if (!session || !attemptId.current) return;

    setIsCheckingReview(true);
    setReviewMessage("");
    setError("");
    try {
      const auth = getStudentFirebaseAuth();
      const user = auth.currentUser ?? (await signInAnonymously(auth)).user;
      const response = await loadStudentAnswerReview({
        roomCode: session.roomCode,
        attemptId: attemptId.current,
        idToken: await user.getIdToken(),
      });
      if (!response.ok) throw new Error(response.error);
      if (!response.available || !response.result) {
        setReviewMessage("Answer review has not been released yet. Check again later.");
        return;
      }

      setResult(response.result);
    } catch (reviewError) {
      setError(reviewError instanceof Error ? reviewError.message : "Answer review could not be checked.");
    } finally {
      setIsCheckingReview(false);
    }
  }

  useEffect(() => {
    if (deadlineAt === null || result) return;

    const updateRemainingTime = () => {
      const seconds = Math.max(0, Math.ceil((deadlineAt - Date.now()) / 1000));
      setRemainingSeconds((current) => current === seconds ? current : seconds);
      if (seconds === 0) window.clearInterval(timer);
    };
    const timer = window.setInterval(updateRemainingTime, 1000);
    document.addEventListener("visibilitychange", updateRemainingTime);
    updateRemainingTime();

    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", updateRemainingTime);
    };
  }, [deadlineAt, result]);

  useEffect(() => {
    if (remainingSeconds === 0 && !result && !submissionStarted.current) {
      void submitAnswers(answers);
    }
  }, [remainingSeconds, result, answers, submitAnswers]);

  function startAttempt(loadedSession: StudentSession) {
    const questions = loadedSession.settings.shuffleQuestions
      ? shuffle(loadedSession.questions)
      : loadedSession.questions;
    const shuffledSession = {
      ...loadedSession,
      questions: questions.map((question) => ({
        ...question,
        options: ["matching", "rearrange"].includes(question.type)
          || (loadedSession.settings.shuffleOptions && question.type !== "truefalse")
          ? shuffle(question.options)
          : question.options,
      })),
    };
    setSession(shuffledSession);
    setAnswers(Object.fromEntries(
      shuffledSession.questions
        .filter((question) => question.type === "rearrange")
        .map((question) => [question.id, question.options]),
    ));
    setResult(null);
    setReviewMessage("");
    setError("");
    submissionStarted.current = false;
    attemptId.current = "";
    const timeLimitSeconds = shuffledSession.settings.timeLimitMinutes
      ? shuffledSession.settings.timeLimitMinutes * 60
      : null;
    setRemainingSeconds(timeLimitSeconds);
    setDeadlineAt(timeLimitSeconds === null ? null : Date.now() + timeLimitSeconds * 1000);
  }

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

      if (response.previousReview) {
        setSession(response.session);
        setAnswers({});
        setResult(response.previousReview);
        setRemainingSeconds(null);
        setDeadlineAt(null);
        submissionStarted.current = false;
        attemptId.current = "";
      } else {
        startAttempt(response.session);
      }
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

  function updateMatch(questionId: string, matchIndex: number, value: string) {
    setAnswers((current) => {
      const question = session?.questions.find((item) => item.id === questionId);
      if (!question) return current;
      const selected = [...(current[questionId] ?? Array(question.matchItems?.length ?? 0).fill(""))];
      selected[matchIndex] = value;
      return { ...current, [questionId]: selected };
    });
  }

  function moveCodeLine(questionId: string, fromIndex: number, toIndex: number) {
    setAnswers((current) => {
      const question = session?.questions.find((item) => item.id === questionId);
      if (!question || toIndex < 0 || toIndex >= question.options.length) return current;
      const orderedLines = [...(current[questionId] ?? question.options)];
      const [line] = orderedLines.splice(fromIndex, 1);
      if (line === undefined) return current;
      orderedLines.splice(toIndex, 0, line);
      return { ...current, [questionId]: orderedLines };
    });
  }

  function hasAnswer(questionId: string) {
    const question = session?.questions.find((item) => item.id === questionId);
    const selected = answers[questionId] ?? [];
    if (question?.type === "matching") {
      return selected.length === question.matchItems?.length && selected.every((answer) => answer.trim());
    }
    if (question?.type === "rearrange") {
      return selected.length === question.options.length;
    }
    return selected.some((answer) => answer.trim());
  }

  function hasAnsweredEveryQuestion() {
    return session?.questions.every((question) => hasAnswer(question.id)) ?? false;
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

  const answeredCount = session.questions.filter((question) => hasAnswer(question.id)).length;
  const isTimedOut = remainingSeconds === 0;

  if (result) {
    return (
      <main className="mx-auto max-w-4xl space-y-6 p-6">
        <Card>
          <CardHeader>
            <Badge className="w-fit">Room {session.roomCode}</Badge>
            <Badge className="w-fit">
              {session.attemptsRemaining} of {session.attemptLimit} attempts remaining
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
                Your response was submitted. Scores are hidden by this quiz&apos;s settings.
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
                          <p className="whitespace-pre-wrap text-sm text-slate-600">
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
              <div className="space-y-3">
                <p className="text-sm text-slate-500">Answer review is not available yet. Check again after your lecturer releases it.</p>
                {reviewMessage && <p role="status" className="text-sm text-slate-600">{reviewMessage}</p>}
                {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
                <Button type="button" variant="outline" disabled={isCheckingReview} onClick={() => void checkAnswerReview()}>
                  {isCheckingReview && <LoaderCircle className="size-4 animate-spin" />}
                  Check for released answers
                </Button>
              </div>
            )}
            {session.canAttempt ? (
              <Button variant="outline" onClick={() => startAttempt(session)}>Start another attempt</Button>
            ) : (
              <Button
                variant="outline"
                onClick={() => {
                  setSession(null);
                  setResult(null);
                  setAnswers({});
                  setRemainingSeconds(null);
                  setDeadlineAt(null);
                  setError("");
                  setReviewMessage("");
                }}
              >
                Choose another quiz
              </Button>
            )}
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
            <Badge>{session.attemptsRemaining} attempt{session.attemptsRemaining === 1 ? "" : "s"} available</Badge>
          </div>
          <p className="text-sm text-slate-500">
            {answeredCount} of {session.questions.length} answered
            {displayName.trim() && ` · ${displayName.trim()}`}
          </p>
        </CardHeader>
      </Card>

      {remainingSeconds !== null && (
        <div className={`sticky top-2 z-20 flex items-center justify-between gap-3 rounded-lg border px-4 py-3 shadow-sm ${
          remainingSeconds <= 60
            ? "border-red-300 bg-red-50 text-red-800"
            : "border-slate-200 bg-white text-slate-800"
        }`}>
          <span className="text-sm font-medium">
            {isTimedOut ? "Time is up — submitting your answers." : "Time remaining"}
          </span>
          <span
            role="timer"
            aria-label={`Time remaining: ${formatTime(remainingSeconds)}`}
            className="flex shrink-0 items-center gap-2 font-mono text-lg font-bold tabular-nums"
          >
            <Clock3 className="h-5 w-5" aria-hidden="true" />
            {formatTime(remainingSeconds)}
          </span>
        </div>
      )}

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
              <CardDescription>
                {question.points} {question.points === 1 ? "point" : "points"}
                {question.type === "rearrange" && " · Drag the items into order or use the arrow buttons."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {question.type === "matching" ? (
                <div className="space-y-3">
                  {question.matchItems?.map((item, matchIndex) => (
                    <label key={item} className="grid items-center gap-2 sm:grid-cols-[1fr_1fr]">
                      <span className="rounded-md bg-slate-50 p-3 text-sm">{item}</span>
                      <select
                        value={selected[matchIndex] ?? ""}
                        onChange={(event) => updateMatch(question.id, matchIndex, event.target.value)}
                        disabled={isSubmitting || isTimedOut}
                        required
                        aria-label={`Match for ${item}`}
                        className="w-full rounded-md border border-slate-200 bg-white p-3 text-sm"
                      >
                        <option value="">Choose a match</option>
                        {question.options.map((option) => (
                          <option key={option} value={option} disabled={selected.includes(option) && selected[matchIndex] !== option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    </label>
                  ))}
                </div>
              ) : question.type === "rearrange" ? (
                <ol className="space-y-2">
                  {selected.map((line, lineIndex) => (
                    <li
                      key={`${line}-${lineIndex}`}
                      draggable={!isSubmitting && !isTimedOut}
                      onDragStart={(event) => event.dataTransfer.setData("text/plain", String(lineIndex))}
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={(event) => {
                        event.preventDefault();
                        const fromIndex = Number(event.dataTransfer.getData("text/plain"));
                        if (Number.isInteger(fromIndex)) moveCodeLine(question.id, fromIndex, lineIndex);
                      }}
                      className="flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 p-2"
                    >
                      <GripVertical className="size-4 shrink-0 text-slate-400" aria-hidden="true" />
                      <pre className="min-w-0 flex-1 overflow-x-auto whitespace-pre-wrap text-sm"><code>{line}</code></pre>
                      <span className="sr-only">Line {lineIndex + 1}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={`Move line ${lineIndex + 1} up`}
                        disabled={isSubmitting || isTimedOut || lineIndex === 0}
                        onClick={() => moveCodeLine(question.id, lineIndex, lineIndex - 1)}
                      >
                        <ArrowUp className="size-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={`Move line ${lineIndex + 1} down`}
                        disabled={isSubmitting || isTimedOut || lineIndex === selected.length - 1}
                        onClick={() => moveCodeLine(question.id, lineIndex, lineIndex + 1)}
                      >
                        <ArrowDown className="size-4" />
                      </Button>
                    </li>
                  ))}
                </ol>
              ) : question.options.length ? (
                <div className="space-y-2">
                  {question.options.map((option) => (
                    <label key={option} className="flex cursor-pointer items-center gap-3 rounded-lg border border-slate-200 p-3 hover:bg-slate-50">
                      <input
                        type={isChoiceQuestion ? "radio" : "checkbox"}
                        name={`question-${question.id}`}
                        value={option}
                        checked={selected.includes(option)}
                        onChange={(event) => updateAnswer(question.id, option, event.target.checked)}
                        disabled={isSubmitting || isTimedOut}
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
                  disabled={isSubmitting || isTimedOut}
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
          disabled={isSubmitting || (!isTimedOut && !hasAnsweredEveryQuestion())}
        >
          {isSubmitting && <LoaderCircle className="h-4 w-4 animate-spin" />}
          {isSubmitting ? "Submitting…" : isTimedOut ? "Retry submission" : "Submit answers"}
        </Button>
      </div>
    </main>
  );
}
