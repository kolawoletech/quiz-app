"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { onAuthStateChanged, signOut } from "firebase/auth";

import { verifyLecturerNavigation } from "@/app/lecturer/actions";
import { getFirebaseAuth, hasFirebaseConfig } from "@/lib/firebase";

const lecturerLinks = [
  { href: "/", label: "Dashboard" },
  { href: "/quizzes", label: "Quizzes" },
  { href: "/questions", label: "Question bank" },
  { href: "/results", label: "Results" },
];

export function SiteNavigation() {
  const [lecturerEmail, setLecturerEmail] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [signOutError, setSignOutError] = useState("");

  useEffect(() => {
    let active = true;
    let unsubscribe = () => {};
    if (hasFirebaseConfig()) {
      unsubscribe = onAuthStateChanged(getFirebaseAuth(), async (user) => {
        if (!active) return;
        setAuthChecked(false);
        setLecturerEmail(null);
        setSignOutError("");

        if (!user || user.providerData.every((provider) => provider.providerId !== "google.com")) {
          setAuthChecked(true);
          return;
        }

        try {
          const result = await verifyLecturerNavigation(await user.getIdToken());
          if (!active) return;
          if (result.ok) setLecturerEmail(result.email);
          else setSignOutError(result.error);
        } catch {
          if (active) {
            setLecturerEmail(null);
            setSignOutError("Lecturer access could not be verified. Try again.");
          }
        } finally {
          if (active) setAuthChecked(true);
        }
      });
    }

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  async function handleSignOut() {
    setSignOutError("");
    try {
      await signOut(getFirebaseAuth());
      setLecturerEmail(null);
    } catch (error) {
      setSignOutError(error instanceof Error ? error.message : "Could not sign out.");
    }
  }

  return (
    <nav aria-label="Main navigation" className="border-b border-slate-200 bg-white/90 backdrop-blur-sm">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <Link href="/" className="text-lg font-bold tracking-tight text-slate-900">
          Eduvos Quiz
        </Link>
        <div className="flex flex-wrap items-center justify-end gap-1 text-sm font-medium text-slate-600">
          <Link href="/join" className="rounded-md px-3 py-2 transition hover:bg-slate-100 hover:text-slate-900">
            Join a quiz
          </Link>
          {lecturerEmail ? (
            <>
              {lecturerLinks.map((link) => (
                <Link key={link.href} href={link.href} className="rounded-md px-3 py-2 transition hover:bg-slate-100 hover:text-slate-900">
                  {link.label}
                </Link>
              ))}
              <button type="button" onClick={handleSignOut} className="rounded-md px-3 py-2 text-slate-600 transition hover:bg-slate-100 hover:text-slate-900">
                Sign out
              </button>
            </>
          ) : (
            <Link href="/quizzes" className="rounded-md bg-slate-900 px-3 py-2 text-white transition hover:bg-slate-700">
              {authChecked ? "Lecturer sign in" : "Lecturer"}
            </Link>
          )}
        </div>
      </div>
      {signOutError && <p role="alert" className="mx-auto max-w-7xl px-6 pb-2 text-right text-xs text-red-700">{signOutError}</p>}
    </nav>
  );
}
