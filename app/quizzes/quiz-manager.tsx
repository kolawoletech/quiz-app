"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { GoogleAuthProvider, onAuthStateChanged, signInWithPopup } from "firebase/auth";
import { ChevronLeft, ChevronRight, LoaderCircle, LogIn, Plus, Save, Search, ShieldCheck, X } from "lucide-react";

import { importQuizJson, loadLecturerQuizzes, saveQuizDraft, transitionQuiz, type QuizActionResponse } from "@/app/quizzes/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getFirebaseAuth, hasFirebaseConfig } from "@/lib/firebase";
import type { Question, QuestionType, Quiz } from "@/lib/mock-data";

type LecturerQuiz = { quiz: Quiz; questions: Question[] };
type EditableQuestion = Omit<Question, "id"> & { id?: string };
type QuizDraft = {
  quizId?: string;
  title: string;
  description: string;
  attemptLimit: number;
  passMark?: number;
  timeLimitMinutes?: number;
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  showScoreAfterSubmit: boolean;
  showCorrectAnswersAfterSubmit: boolean;
  mode: "self-paced" | "live";
  questions: EditableQuestion[];
};

const QUIZZES_PER_PAGE = 6;

const newQuestion = (): EditableQuestion => ({
  type: "single",
  question: "",
  options: ["Option 1", "Option 2"],
  answer: ["Option 1"],
  explanation: "",
  points: 1,
  difficulty: "unrated",
  tags: [],
  ownerUid: "",
  createdAt: new Date().toISOString(),
});

function emptyDraft(): QuizDraft {
  return {
    title: "",
    description: "",
    attemptLimit: 1,
    shuffleQuestions: false,
    shuffleOptions: false,
    showScoreAfterSubmit: true,
    showCorrectAnswersAfterSubmit: false,
    mode: "self-paced",
    questions: [newQuestion()],
  };
}

function draftFromQuiz({ quiz, questions }: LecturerQuiz): QuizDraft {
  return {
    quizId: quiz.id,
    title: quiz.title,
    description: quiz.description,
    attemptLimit: quiz.settings.attemptLimit,
    passMark: quiz.settings.passMark,
    timeLimitMinutes: quiz.settings.timeLimitMinutes,
    shuffleQuestions: quiz.settings.shuffleQuestions,
    shuffleOptions: quiz.settings.shuffleOptions,
    showScoreAfterSubmit: quiz.settings.showScoreAfterSubmit,
    showCorrectAnswersAfterSubmit: quiz.settings.showCorrectAnswersAfterSubmit,
    mode: quiz.settings.mode,
    questions: questions.map(({ id, ...question }) => ({ id, ...question })),
  };
}

function statusAction(status: Quiz["status"]): { action: "publish" | "pause" | "resume" | "close"; label: string }[] {
  if (status === "draft") return [{ action: "publish", label: "Publish" }];
  if (status === "published") return [
    { action: "pause", label: "Pause joins" },
    { action: "close", label: "Close permanently" },
  ];
  if (status === "paused") return [
    { action: "resume", label: "Resume" },
    { action: "close", label: "Close permanently" },
  ];
  return [];
}

export function QuizManager() {
  const [quizzes, setQuizzes] = useState<LecturerQuiz[] | null>(null);
  const [lecturerEmail, setLecturerEmail] = useState("");
  const [draft, setDraft] = useState<QuizDraft | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [busyQuizId, setBusyQuizId] = useState("");
  const [importFile, setImportFile] = useState<File | null>(null);
  const importInputRef = useRef<HTMLInputElement>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | Quiz["status"]>("all");
  const [quizPage, setQuizPage] = useState(1);

  const refreshQuizzes = useCallback(async (idToken: string) => {
    const response = await loadLecturerQuizzes(idToken);
    if (!response.ok) {
      setQuizzes(null);
      setError(response.error);
      return false;
    }
    setQuizzes(response.data);
    setLecturerEmail(response.email);
    setError("");
    return true;
  }, []);

  useEffect(() => {
    let active = true;
    let unsubscribe = () => {};

    if (hasFirebaseConfig()) {
      unsubscribe = onAuthStateChanged(getFirebaseAuth(), async (user) => {
        if (!active) return;
        if (!user || user.providerData.every((provider) => provider.providerId !== "google.com")) {
          setQuizzes(null);
          setLecturerEmail("");
          setDraft(null);
          setError("");
          setIsLoading(false);
          return;
        }

        setQuizzes(null);
        setLecturerEmail("");
        setDraft(null);
        setIsLoading(true);
        setError("");
        try {
          await refreshQuizzes(await user.getIdToken());
        } catch (loadError) {
          if (active) {
            setQuizzes(null);
            setError(loadError instanceof Error ? loadError.message : "Lecturer quizzes could not be loaded.");
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
  }, [refreshQuizzes]);

  async function signIn() {
    setIsLoading(true);
    setError("");
    try {
      const credential = await signInWithPopup(getFirebaseAuth(), new GoogleAuthProvider());
      await refreshQuizzes(await credential.user.getIdToken());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Lecturer sign-in failed.");
    } finally {
      setIsLoading(false);
    }
  }

  async function saveDraft(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft) return;

    setIsLoading(true);
    setError("");
    setNotice("");
    try {
      const user = getFirebaseAuth().currentUser;
      if (!user) throw new Error("Sign in again to save this quiz.");
      const response: QuizActionResponse<LecturerQuiz> = await saveQuizDraft({
        ...draft,
        idToken: await user.getIdToken(),
        questions: draft.questions.map((question) => ({
          ...question,
          options: ["single", "multiple", "truefalse", "matching", "rearrange"].includes(question.type)
            ? question.options
            : [],
          ...(question.type === "matching" ? { matchItems: question.matchItems ?? [] } : {}),
          answer: question.answer,
          tags: question.tags,
        })),
      });
      if (!response.ok) {
        setError(response.error);
        return;
      }
      setDraft(draftFromQuiz(response.data));
      setQuizzes((current) => [
        ...((current ?? []).filter(({ quiz }) => quiz.id !== response.data.quiz.id)),
        response.data,
      ].sort((first, second) => first.quiz.title.localeCompare(second.quiz.title)));
      setNotice("Draft saved. Review it before publishing.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "The draft could not be saved.");
    } finally {
      setIsLoading(false);
    }
  }

  async function importJson() {
    if (!importFile) return;

    setIsLoading(true);
    setError("");
    setNotice("");
    try {
      const user = getFirebaseAuth().currentUser;
      if (!user) throw new Error("Sign in again to import a quiz.");
      const response: QuizActionResponse<LecturerQuiz> = await importQuizJson(
        await user.getIdToken(),
        await importFile.text(),
      );
      if (!response.ok) {
        setError(response.error);
        return;
      }
      setQuizzes((current) => [
        ...((current ?? []).filter(({ quiz }) => quiz.id !== response.data.quiz.id)),
        response.data,
      ].sort((first, second) => first.quiz.title.localeCompare(second.quiz.title)));
      setImportFile(null);
      if (importInputRef.current) importInputRef.current.value = "";
      setNotice(`Imported "${response.data.quiz.title}" as a draft. Room code ${response.data.quiz.roomCode}; review it before publishing.`);
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : "The quiz JSON could not be imported.");
    } finally {
      setIsLoading(false);
    }
  }

  async function changeStatus(quizId: string, action: "publish" | "pause" | "resume" | "close") {
    setBusyQuizId(quizId);
    setError("");
    setNotice("");
    try {
      const user = getFirebaseAuth().currentUser;
      if (!user) throw new Error("Sign in again to manage this quiz.");
      const response: QuizActionResponse<Quiz> = await transitionQuiz({
        quizId,
        action,
        idToken: await user.getIdToken(),
      });
      if (!response.ok) {
        setError(response.error);
        return;
      }
      setQuizzes((current) => (current ?? []).map((entry) =>
        entry.quiz.id === quizId ? { ...entry, quiz: response.data } : entry,
      ));
      setNotice(`Quiz ${response.data.status}.`);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "The quiz status could not be changed.");
    } finally {
      setBusyQuizId("");
    }
  }

  function updateQuestion(index: number, patch: Partial<EditableQuestion>) {
    setDraft((current) => current && ({
      ...current,
      questions: current.questions.map((question, questionIndex) =>
        questionIndex === index ? { ...question, ...patch } : question,
      ),
    }));
  }

  function editDraft(quiz: LecturerQuiz) {
    setError("");
    setNotice("");
    setDraft(draftFromQuiz(quiz));
  }

  const filteredQuizzes = useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase();
    return (quizzes ?? []).filter(({ quiz, questions }) => {
      const matchesStatus = statusFilter === "all" || quiz.status === statusFilter;
      const searchableText = [
        quiz.title,
        quiz.description,
        quiz.roomCode,
        quiz.status,
        ...questions.flatMap((question) => question.tags),
      ].join(" ").toLocaleLowerCase();
      return matchesStatus && (!query || searchableText.includes(query));
    });
  }, [quizzes, searchQuery, statusFilter]);
  const quizPageCount = Math.max(1, Math.ceil(filteredQuizzes.length / QUIZZES_PER_PAGE));
  const currentQuizPage = Math.min(quizPage, quizPageCount);
  const visibleQuizzes = filteredQuizzes.slice((currentQuizPage - 1) * QUIZZES_PER_PAGE, currentQuizPage * QUIZZES_PER_PAGE);
  const checkboxClass = "size-4 accent-blue-700";
  const labelClass = "space-y-1 text-sm font-medium text-slate-700";
  const controlClass = "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm";

  return (
    <main className="mx-auto max-w-7xl space-y-6 p-6">
      <header className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.2em] text-blue-600">Quiz builder</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">Manage quizzes and settings</h1>
          <CardDescription className="mt-2">Create drafts, control room access, and set a 1–10 attempt limit.</CardDescription>
        </div>
        {!quizzes ? (
          <Button onClick={signIn} disabled={isLoading}>
            {isLoading ? <LoaderCircle className="size-4 animate-spin" /> : <LogIn className="size-4" />}
            Sign in with Google
          </Button>
        ) : (
          <Button onClick={() => { setError(""); setNotice(""); setDraft(emptyDraft()); }}>
            <Plus className="size-4" /> Create quiz
          </Button>
        )}
      </header>

      {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</p>}
      {notice && <p role="status" className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800">{notice}</p>}

      {!quizzes ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><ShieldCheck className="size-5 text-blue-700" /> Lecturer sign-in required</CardTitle>
            <CardDescription>Only authorized lecturers can view question content or manage quizzes.</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <>
          <p className="text-sm text-slate-600">Signed in as {lecturerEmail}</p>
          <Card>
            <CardHeader>
              <CardTitle>Import a quiz from JSON</CardTitle>
              <CardDescription>
                Import a practice quiz JSON or the standard format described in the README. Imports create a new draft and never overwrite a quiz.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <Input
                ref={importInputRef}
                type="file"
                accept=".json,application/json"
                aria-label="Select quiz JSON file"
                onChange={(event) => {
                  const file = event.target.files?.[0] ?? null;
                  if (file && file.size > 1_000_000) {
                    setImportFile(null);
                    setError("Choose a JSON file smaller than 1 MB.");
                    return;
                  }
                  setError("");
                  setImportFile(file);
                }}
              />
              <Button type="button" disabled={!importFile || isLoading} onClick={() => void importJson()}>
                {isLoading ? <LoaderCircle className="size-4 animate-spin" /> : <Plus className="size-4" />}
                Import as draft
              </Button>
            </CardContent>
          </Card>
          {draft && (
            <form onSubmit={saveDraft} className="space-y-5">
              <Card>
                <CardHeader className="flex-row items-start justify-between">
                  <div>
                    <CardTitle>{draft.quizId ? "Edit draft" : "Create quiz draft"}</CardTitle>
                    <CardDescription>Published quizzes are locked to protect existing submissions and results.</CardDescription>
                  </div>
                  <Button type="button" variant="ghost" aria-label="Close editor" onClick={() => setDraft(null)}><X className="size-4" /></Button>
                </CardHeader>
                <CardContent className="grid gap-4 sm:grid-cols-2">
                  <label className={labelClass}>Quiz title
                    <Input required maxLength={120} value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} />
                  </label>
                  <label className={labelClass}>Description
                    <Input maxLength={1000} value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} />
                  </label>
                  <label className={labelClass}>Attempts allowed (1–10)
                    <Input required type="number" min={1} max={10} value={draft.attemptLimit} onChange={(event) => setDraft({ ...draft, attemptLimit: Number(event.target.value) })} />
                  </label>
                  <label className={labelClass}>Pass mark (%) — optional
                    <Input type="number" min={0} max={100} value={draft.passMark ?? ""} onChange={(event) => setDraft({ ...draft, passMark: event.target.value === "" ? undefined : Number(event.target.value) })} />
                  </label>
                  <label className={labelClass}>Time limit in minutes — optional
                    <Input type="number" min={1} max={600} value={draft.timeLimitMinutes ?? ""} onChange={(event) => setDraft({ ...draft, timeLimitMinutes: event.target.value === "" ? undefined : Number(event.target.value) })} />
                  </label>
                  <label className={labelClass}>Quiz mode
                    <select className={controlClass} value={draft.mode} onChange={(event) => setDraft({ ...draft, mode: event.target.value as QuizDraft["mode"] })}>
                      <option value="self-paced">Self-paced</option><option value="live">Live</option>
                    </select>
                  </label>
                  <div className="flex flex-wrap gap-x-5 gap-y-2 sm:col-span-2">
                    {([
                      ["shuffleQuestions", "Shuffle questions"],
                      ["shuffleOptions", "Shuffle options"],
                      ["showScoreAfterSubmit", "Show score after submission"],
                      ["showCorrectAnswersAfterSubmit", "Show answer review after submission"],
                    ] as const).map(([key, label]) => (
                      <label key={key} className="flex items-center gap-2 text-sm text-slate-700">
                        <input className={checkboxClass} type="checkbox" checked={draft[key]} onChange={(event) => setDraft({ ...draft, [key]: event.target.checked })} />
                        {label}
                      </label>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {draft.questions.map((question, index) => (
                <Card key={question.id ?? `question-${index}`}>
                  <CardHeader className="flex-row items-center justify-between">
                    <div><CardTitle className="text-lg">Question {index + 1}</CardTitle><CardDescription>Correct answers are stored and graded on the server.</CardDescription></div>
                    <Button type="button" variant="outline" disabled={draft.questions.length === 1} onClick={() => setDraft({ ...draft, questions: draft.questions.filter((_, questionIndex) => questionIndex !== index) })}>Remove</Button>
                  </CardHeader>
                  <CardContent className="grid gap-4 sm:grid-cols-2">
                    <label className={`${labelClass} sm:col-span-2`}>Question
                      <textarea required maxLength={5000} rows={3} className={controlClass} value={question.question} onChange={(event) => updateQuestion(index, { question: event.target.value })} />
                    </label>
                    <label className={labelClass}>Type
                      <select className={controlClass} value={question.type} onChange={(event) => {
                        const type = event.target.value as QuestionType;
                        const options = type === "truefalse"
                          ? ["True", "False"]
                          : type === "matching"
                            ? ["Option 1", "Option 2"]
                            : type === "rearrange"
                              ? ["Code line 1", "Code line 2"]
                              : ["single", "multiple"].includes(type)
                                ? ["Option 1", "Option 2"]
                                : [];
                        updateQuestion(index, {
                          type,
                          options,
                          matchItems: type === "matching" ? ["Item 1", "Item 2"] : undefined,
                          answer: type === "matching" || type === "rearrange"
                            ? [...options]
                            : [type === "truefalse" ? "True" : options[0] ?? ""],
                        });
                      }}>
                        <option value="single">Single choice</option><option value="multiple">Multiple choice</option>
                        <option value="truefalse">True / false</option><option value="matching">Matching columns</option>
                        <option value="rearrange">Rearrange / ranking (drag and drop)</option><option value="short">Short answer</option><option value="code">Code response</option>
                      </select>
                    </label>
                    <label className={labelClass}>Points
                      <Input required type="number" min={1} max={100} value={question.points} onChange={(event) => updateQuestion(index, { points: Number(event.target.value) })} />
                    </label>
                    {["single", "multiple"].includes(question.type) && (
                      <label className={`${labelClass} sm:col-span-2`}>Options (one per line)
                        <textarea rows={4} className={controlClass} value={question.options.join("\n")} onChange={(event) => updateQuestion(index, { options: event.target.value.split("\n").map((item) => item.trim()).filter(Boolean) })} />
                      </label>
                    )}
                    {question.type === "matching" && (
                      <>
                        <label className={`${labelClass} sm:col-span-2`}>Left-column items (one per line)
                          <textarea rows={4} className={controlClass} value={(question.matchItems ?? []).join("\n")} onChange={(event) => updateQuestion(index, { matchItems: event.target.value.split("\n").map((item) => item.trim()).filter(Boolean) })} />
                        </label>
                        <label className={`${labelClass} sm:col-span-2`}>Right-column choices (one per line)
                          <textarea rows={4} className={controlClass} value={question.options.join("\n")} onChange={(event) => updateQuestion(index, { options: event.target.value.split("\n").map((item) => item.trim()).filter(Boolean) })} />
                        </label>
                        <fieldset className="space-y-3 sm:col-span-2">
                          <legend className={labelClass}>Correct matches</legend>
                          {(question.matchItems ?? []).map((item, itemIndex) => (
                            <label key={`${item}-${itemIndex}`} className="grid items-center gap-2 text-sm sm:grid-cols-[1fr_1fr]">
                              <span>{item}</span>
                              <select
                                required
                                className={controlClass}
                                value={question.answer[itemIndex] ?? ""}
                                onChange={(event) => {
                                  const answer = [...question.answer];
                                  answer[itemIndex] = event.target.value;
                                  updateQuestion(index, { answer });
                                }}
                              >
                                <option value="">Choose a match</option>
                                {question.options.map((option) => (
                                  <option key={option} value={option} disabled={question.answer.includes(option) && question.answer[itemIndex] !== option}>
                                    {option}
                                  </option>
                                ))}
                              </select>
                            </label>
                          ))}
                        </fieldset>
                      </>
                    )}
                    {question.type === "rearrange" ? (
                      <label className={`${labelClass} sm:col-span-2`}>Correct order or ranking (one item per line)
                        <textarea
                          required
                          rows={8}
                          className={`${controlClass} font-mono`}
                          value={question.options.join("\n")}
                          onChange={(event) => {
                            const lines = event.target.value.split("\n").filter((line) => line.trim());
                            updateQuestion(index, { options: lines, answer: lines });
                          }}
                        />
                        <span className="font-normal text-slate-500">Students will receive these items in a shuffled order.</span>
                      </label>
                    ) : null}
                    {["single", "multiple", "truefalse", "short", "code"].includes(question.type) && (
                      <label className={labelClass}>Correct answer{question.type === "multiple" ? "s (one per line)" : ""}
                      {question.type === "multiple" ? (
                        <textarea required rows={3} className={controlClass} value={question.answer.join("\n")} onChange={(event) => updateQuestion(index, { answer: event.target.value.split("\n").map((item) => item.trim()).filter(Boolean) })} />
                      ) : question.type === "truefalse" ? (
                        <select required className={controlClass} value={question.answer[0] ?? ""} onChange={(event) => updateQuestion(index, { answer: [event.target.value] })}>
                          <option value="True">True</option><option value="False">False</option>
                        </select>
                      ) : (
                        <Input required value={question.answer[0] ?? ""} onChange={(event) => updateQuestion(index, { answer: [event.target.value] })} />
                      )}
                      </label>
                    )}
                    <label className={labelClass}>Explanation — optional
                      <Input maxLength={5000} value={question.explanation} onChange={(event) => updateQuestion(index, { explanation: event.target.value })} />
                    </label>
                    {(question.type === "code") && (
                      <label className={`${labelClass} sm:col-span-2`}>Code prompt
                        <textarea rows={4} className={controlClass} value={question.codeSnippet ?? ""} onChange={(event) => updateQuestion(index, { codeSnippet: event.target.value })} />
                      </label>
                    )}
                  </CardContent>
                </Card>
              ))}

              <div className="flex flex-wrap gap-3">
                <Button type="button" variant="outline" disabled={draft.questions.length >= 100} onClick={() => setDraft({ ...draft, questions: [...draft.questions, newQuestion()] })}><Plus className="size-4" /> Add question</Button>
                <Button type="submit" disabled={isLoading}>{isLoading ? <LoaderCircle className="size-4 animate-spin" /> : <Save className="size-4" />} Save draft</Button>
              </div>
            </form>
          )}

          <section className="space-y-4">
            <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:flex-row">
              <label className="relative flex-1">
                <span className="sr-only">Search quizzes</span>
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                <Input
                  value={searchQuery}
                  onChange={(event) => {
                    setSearchQuery(event.target.value);
                    setQuizPage(1);
                  }}
                  placeholder="Search title, description, room code, or tag"
                  className="pl-9"
                />
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-600">
                <span>Status</span>
                <select
                  className="h-10 rounded-md border border-slate-200 bg-white px-3"
                  value={statusFilter}
                  onChange={(event) => {
                    setStatusFilter(event.target.value as "all" | Quiz["status"]);
                    setQuizPage(1);
                  }}
                >
                  <option value="all">All statuses</option>
                  <option value="draft">Draft</option>
                  <option value="published">Published</option>
                  <option value="paused">Paused</option>
                  <option value="closed">Closed</option>
                </select>
              </label>
            </div>

            <p className="text-sm text-slate-500" aria-live="polite">
              {filteredQuizzes.length === 0
                ? "No quizzes match your search."
                : `Showing ${(currentQuizPage - 1) * QUIZZES_PER_PAGE + 1}–${Math.min(currentQuizPage * QUIZZES_PER_PAGE, filteredQuizzes.length)} of ${filteredQuizzes.length} quizzes`}
            </p>

            <div className="grid gap-6 lg:grid-cols-2">
            {visibleQuizzes.map(({ quiz, questions }) => (
              <Card key={quiz.id}>
                <CardHeader>
                  <div className="flex items-start justify-between gap-3">
                    <div><CardTitle className="text-xl">{quiz.title}</CardTitle><CardDescription className="mt-1">{quiz.description || "No description"}</CardDescription></div>
                    <Badge>{quiz.status}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-3 text-sm text-slate-600 sm:grid-cols-2">
                    <div className="rounded-lg border bg-slate-50 p-3">Room code: <strong>{quiz.roomCode}</strong></div>
                    <div className="rounded-lg border bg-slate-50 p-3">Questions: {questions.length}</div>
                    <div className="rounded-lg border bg-slate-50 p-3">Attempts per student: {quiz.settings.attemptLimit}</div>
                    <div className="rounded-lg border bg-slate-50 p-3">Time limit: {quiz.settings.timeLimitMinutes ? `${quiz.settings.timeLimitMinutes} minutes` : "None"}</div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {quiz.status === "draft" && <Button variant="secondary" onClick={() => editDraft({ quiz, questions })}>Edit draft</Button>}
                    {statusAction(quiz.status).map(({ action, label }) => (
                      <Button key={action} variant={action === "close" ? "outline" : "default"} disabled={busyQuizId === quiz.id} onClick={() => void changeStatus(quiz.id, action)}>
                        {busyQuizId === quiz.id && <LoaderCircle className="size-4 animate-spin" />}{label}
                      </Button>
                    ))}
                  </div>
                  {quiz.status === "closed" && <p className="text-xs text-slate-500">Closed quizzes cannot be reopened. Existing results are retained.</p>}
                </CardContent>
              </Card>
            ))}
            {filteredQuizzes.length === 0 && (
              <Card className="lg:col-span-2"><CardContent className="py-10 text-center text-slate-600">
                {quizzes.length === 0 ? "No quizzes yet. Create a quiz draft or import a JSON file to get started." : "Try another search or choose a different status filter."}
              </CardContent></Card>
            )}
            </div>
            {quizPageCount > 1 && (
              <nav aria-label="Quiz list pages" className="flex items-center justify-center gap-3">
                <Button type="button" variant="outline" size="sm" disabled={currentQuizPage === 1} onClick={() => setQuizPage((page) => Math.max(1, Math.min(page, quizPageCount) - 1))}>
                  <ChevronLeft className="size-4" /> Previous
                </Button>
                <span className="text-sm text-slate-600">Page {currentQuizPage} of {quizPageCount}</span>
                <Button type="button" variant="outline" size="sm" disabled={currentQuizPage === quizPageCount} onClick={() => setQuizPage((page) => Math.min(quizPageCount, Math.min(page, quizPageCount) + 1))}>
                  Next <ChevronRight className="size-4" />
                </Button>
              </nav>
            )}
          </section>
        </>
      )}
    </main>
  );
}
