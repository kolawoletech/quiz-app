import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { quizSummaries } from "@/lib/mock-data";

export default function QuizzesPage() {
  return (
    <main className="mx-auto max-w-7xl space-y-6 p-6">
      <header className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.2em] text-blue-600">Quiz builder</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">Manage quizzes and settings</h1>
        </div>
        <Button>Create quiz</Button>
      </header>

      <section className="grid gap-6 lg:grid-cols-2">
        {quizSummaries.map((quiz) => (
          <Card key={quiz.id}>
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-xl">{quiz.title}</CardTitle>
                  <CardDescription>{quiz.description}</CardDescription>
                </div>
                <Badge>{quiz.status}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 text-sm text-slate-600 sm:grid-cols-2">
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">Mode: {quiz.settings.mode}</div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">Questions: {quiz.questionCount}</div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">Attempts: {quiz.settings.allowOneAttempt ? "One" : "Multiple"}</div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">Timer: {quiz.settings.timeLimitMinutes ?? "None"}</div>
                {quiz.settings.passMark !== undefined && (
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">Pass mark: {quiz.settings.passMark}%</div>
                )}
              </div>
              <div className="flex gap-2">
                <Button variant="secondary">Edit</Button>
                <Button variant="outline">Duplicate</Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </section>
    </main>
  );
}
