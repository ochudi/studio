"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error ?? "Something went sideways. Try again.");
        setBusy(false);
        return;
      }
      const from = params.get("from");
      router.replace(from && from.startsWith("/") ? from : "/");
      router.refresh();
    } catch {
      setError("Network hiccup. Try again.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-8">
      <label
        htmlFor="password"
        className="block font-mono text-[10px] uppercase tracking-[0.22em] text-muted"
      >
        Password
      </label>
      <input
        id="password"
        type="password"
        autoFocus
        autoComplete="current-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="mt-2 w-full border-b border-line bg-transparent pb-2 text-fluid-lg outline-none transition-colors focus:border-fg"
      />
      {error && (
        <p role="alert" className="mt-3 text-fluid-xs text-muted">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={busy || password.length === 0}
        className="mt-8 inline-flex w-full items-center justify-center rounded-full bg-fg px-6 py-3.5 font-mono text-fluid-xs uppercase tracking-[0.18em] text-bg transition-opacity duration-300 hover:opacity-85 disabled:opacity-40"
      >
        {busy ? "Checking" : "Enter"}
      </button>
    </form>
  );
}
