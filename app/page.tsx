import { ArrowRight, ChartColumn, CheckCircle2, Plus, Users } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { dashboardStats, liveSessions, quizSummaries } from "@/lib/mock-data";

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-50 p-6 text-slate-900">
      <div className="mx-auto max-w-7xl space-y-8">
        <header className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-blue-600">Eduvos</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight">Quiz and Classroom Polling MVP</h1>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="secondary">Import questions</Button>
            <Button>
              Create quiz <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {dashboardStats.map((stat) => (
            <Card key={stat.label}>
              <CardHeader className="pb-3">
                <p className="text-sm text-slate-500">{stat.label}</p>
                <CardTitle className="text-3xl">{stat.value}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-slate-500">{stat.detail}</p>
              </CardContent>
            </Card>
          ))}
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4">
              <div>
                <CardTitle>Recent quiz activity</CardTitle>
                <CardDescription>Latest created and published assessments.</CardDescription>
              </div>
              <Button variant="outline" size="sm">
                <Plus className="mr-2 h-4 w-4" />
                New quiz
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {quizSummaries.map((quiz) => (
                <div key={quiz.id} className="rounded-xl border border-slate-200 p-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <h3 className="text-lg font-semibold">{quiz.title}</h3>
                      <p className="text-sm text-slate-500">{quiz.description}</p>
                    </div>
                    <Badge>{quiz.status}</Badge>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-3 text-sm text-slate-500">
                    <span>{quiz.questionCount} questions</span>
                    <span>{quiz.settings.mode}</span>
                    <span>{quiz.settings.timeLimitMinutes ? `${quiz.settings.timeLimitMinutes} min` : "No timer"}</span>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Live sessions</CardTitle>
              <CardDescription>Active classroom rooms and response counts.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {liveSessions.map((session) => (
                <div key={session.roomCode} className="flex items-center justify-between rounded-xl border border-slate-200 p-4">
                  <div>
                    <p className="font-semibold">Room {session.roomCode}</p>
                    <p className="text-sm text-slate-500">{session.title}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">{session.responses}</p>
                    <p className="text-xs text-slate-500">responses</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-6 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-blue-600" />
                <CardTitle>Question bank</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-slate-500">Question content and answer keys are protected behind lecturer sign-in.</p>
              <ul className="space-y-2 text-sm text-slate-600">
                <li>• Search by text, tag, or difficulty</li>
                <li>• Import JSON question sets</li>
                <li>• Reuse questions across multiple quizzes</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <ChartColumn className="h-5 w-5 text-emerald-600" />
                <CardTitle>Results analytics</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-slate-500">Live response summaries and post-submission grade review.</p>
              <ul className="space-y-2 text-sm text-slate-600">
                <li>• Average score tracking</li>
                <li>• Answer distribution charts</li>
                <li>• CSV export for results</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-violet-600" />
                <CardTitle>Anonymous student flow</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-slate-500">Students join with a room code and answer without creating an account.</p>
              <ul className="space-y-2 text-sm text-slate-600">
                <li>• Temporary anonymous identifiers</li>
                <li>• Live and self-paced modes</li>
                <li>• Secure room access and validation</li>
              </ul>
            </CardContent>
          </Card>
        </section>
      </div>
    </main>
  );
}
