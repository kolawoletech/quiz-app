"use client";

import { useState, type FormEvent } from "react";
import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { LoaderCircle, LogIn, Plus, Save, ShieldCheck, X } from "lucide-react";

import { loadLecturerQuizzes, saveQuizDraft, transitionQuiz, type QuizActionResponse } from "@/app/quizzes/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getFirebaseAuth } from "@/lib/firebase";
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

  async function refreshQuizzes(idToken: string) {
    const response = await loadLecturerQuizzes(idToken);
    if (!response.ok) {
      setQuizzes(null);
      setError(response.error);
      return false;
    }
    setQuizzes(response.data);
    setLecturerEmail(response.email);
    return true;
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
          options: ["single", "multiple", "truefalse"].includes(question.type)
            ? question.options
            : [],
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
                        updateQuestion(index, {
                          type,
                          options: ["single", "multiple", "truefalse"].includes(type) ? (type === "truefalse" ? ["True", "False"] : ["Option 1", "Option 2"]) : [],
                          answer: [type === "truefalse" ? "True" : ""],
                        });
                      }}>
                        <option value="single">Single choice</option><option value="multiple">Multiple choice</option>
                        <option value="truefalse">True / false</option><option value="short">Short answer</option><option value="code">Code response</option>
                      </select>
                    </label>
                    <label className={labelClass}>Points
                      <Input required type="number" min={1} max={100} value={question.points} onChange={(event) => updateQuestion(index, { points: Number(event.target.value) })} />
                    </label>
                    {["single", "multiple", "truefalse"].includes(question.type) && (
                      <label className={`${labelClass} sm:col-span-2`}>Options (one per line)
                        <textarea rows={4} className={controlClass} value={question.options.join("\n")} onChange={(event) => updateQuestion(index, { options: event.target.value.split("\n").map((item) => item.trim()).filter(Boolean) })} />
                      </label>
                    )}
                    <label className={labelClass}>Correct answer{question.type === "multiple" ? "s (one per line)" : ""}
                      {question.type === "multiple" ? (
                        <textarea required rows={3} className={controlClass} value={question.answer.join("\n")} onChange={(event) => updateQuestion(index, { answer: event.target.value.split("\n").map((item) => item.trim()).filter(Boolean) })} />
                      ) : (
                        <Input required value={question.answer[0] ?? ""} onChange={(event) => updateQuestion(index, { answer: [event.target.value] })} />
                      )}
                    </label>
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

          <section className="grid gap-6 lg:grid-cols-2">
            {quizzes.map(({ quiz, questions }) => (
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
            {quizzes.length === 0 && !draft && (
              <Card className="lg:col-span-2"><CardContent className="py-10 text-center text-slate-600">No quizzes yet. Create a quiz draft to get started.</CardContent></Card>
            )}
          </section>
        </>
      )}
    </main>
  );
}
