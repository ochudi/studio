import type { Metadata } from "next";
import { Suspense } from "react";
import LoginForm from "@/components/LoginForm";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <main className="flex min-h-[100svh] items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <p className="font-mono text-fluid-xs uppercase tracking-[0.18em] text-muted">
          Greyform Studio
        </p>
        <h1 className="mt-3 font-display tracking-tightest text-fluid-3xl leading-[1.05]">
          The back office.
        </h1>
        <p className="mt-3 text-fluid-sm leading-relaxed text-muted">
          Everything the studio runs on, behind one password.
        </p>
        <Suspense>
          <LoginForm />
        </Suspense>
      </div>
    </main>
  );
}
