import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const resultRows = [
  { question: "ConditionalAttribute", correct: 23, total: 28, percent: 82 },
  { question: "Value types", correct: 19, total: 28, percent: 68 },
  { question: "Static method access", correct: 25, total: 28, percent: 89 },
];

export default function ResultsPage() {
  return (
    <main className="mx-auto max-w-7xl space-y-6 p-6">
      <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm uppercase tracking-[0.2em] text-blue-600">Results</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">Advanced C# First Hour</h1>
        <CardDescription className="mt-2">Live aggregate view for the current classroom session.</CardDescription>
      </header>

      <section className="grid gap-6 md:grid-cols-3">
        {[
          { label: "Participants", value: "28" },
          { label: "Average score", value: "78%" },
          { label: "Completion", value: "96%" },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardHeader>
              <CardTitle>{stat.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </section>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <CardTitle>Per-question performance</CardTitle>
            <Badge>Updated 2 mins ago</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {resultRows.map((row) => (
            <div key={row.question} className="space-y-2">
              <div className="flex items-center justify-between text-sm text-slate-700">
                <span>{row.question}</span>
                <span>{row.correct}/{row.total}</span>
              </div>
              <div className="h-2.5 w-full rounded-full bg-slate-200">
                <div className="h-2.5 rounded-full bg-blue-600" style={{ width: `${row.percent}%` }} />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </main>
  );
}
