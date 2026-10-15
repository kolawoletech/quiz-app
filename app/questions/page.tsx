import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { questionBank } from "@/lib/mock-data";

export default function QuestionsPage() {
  return (
    <main className="mx-auto max-w-7xl space-y-6 p-6">
      <header className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.2em] text-blue-600">Question bank</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">Reusable C# question library</h1>
        </div>
        <Button>New question</Button>
      </header>

      <section className="grid gap-6 lg:grid-cols-2">
        {questionBank.map((question) => (
          <Card key={question.id}>
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-xl">{question.question}</CardTitle>
                  <CardDescription className="mt-2">Type: {question.type}</CardDescription>
                </div>
                <Badge>{question.difficulty}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {question.tags.map((tag) => (
                  <Badge key={tag} className="border-blue-200 bg-blue-50 text-blue-700">{tag}</Badge>
                ))}
              </div>
              <ul className="space-y-2 text-sm text-slate-600">
                {question.options.map((option) => (
                  <li key={option} className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                    {option}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))}
      </section>
    </main>
  );
}
