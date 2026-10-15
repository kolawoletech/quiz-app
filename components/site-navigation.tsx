import Link from "next/link";

const links = [
  { href: "/", label: "Dashboard" },
  { href: "/questions", label: "Question bank" },
  { href: "/quizzes", label: "Quizzes" },
  { href: "/join", label: "Student join" },
  { href: "/results", label: "Results" },
];

export function SiteNavigation() {
  return (
    <nav className="border-b border-slate-200 bg-white/80 backdrop-blur-sm">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        <Link href="/" className="text-lg font-bold tracking-tight text-slate-900">
          Eduvos Quiz
        </Link>
        <div className="flex items-center gap-2 text-sm font-medium text-slate-600">
          {links.map((link) => (
            <Link key={link.href} href={link.href} className="rounded-md px-3 py-2 transition hover:bg-slate-100 hover:text-slate-900">
              {link.label}
            </Link>
          ))}
        </div>
      </div>
    </nav>
  );
}
