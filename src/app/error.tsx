"use client";

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="flex min-h-[100svh] items-center justify-center px-6">
      <div className="max-w-sm">
        <p className="font-mono text-fluid-xs uppercase tracking-[0.18em] text-muted">
          Error
        </p>
        <h1 className="mt-3 font-display tracking-tightest text-fluid-3xl leading-[1.05]">
          That broke.
        </h1>
        <p className="mt-3 text-fluid-sm leading-relaxed text-muted">
          Nothing was lost. Try again; if it keeps happening, check the Vercel logs.
        </p>
        <button
          type="button"
          onClick={reset}
          className="mt-8 inline-flex items-center rounded-full bg-fg px-6 py-3.5 font-mono text-fluid-xs uppercase tracking-[0.18em] text-bg transition-opacity duration-300 hover:opacity-85"
        >
          Try again
        </button>
      </div>
    </main>
  );
}
