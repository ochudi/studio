import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-[100svh] items-center justify-center px-6">
      <div className="max-w-sm">
        <p className="font-mono text-fluid-xs uppercase tracking-[0.18em] text-muted">
          404
        </p>
        <h1 className="mt-3 font-display tracking-tightest text-fluid-3xl leading-[1.05]">
          Not a page.
        </h1>
        <p className="mt-3 text-fluid-sm leading-relaxed text-muted">
          Whatever was here isn&rsquo;t. The dashboard knows the way back.
        </p>
        <Link
          href="/"
          className="mt-8 inline-flex items-center rounded-full bg-fg px-6 py-3.5 font-mono text-fluid-xs uppercase tracking-[0.18em] text-bg transition-opacity duration-300 hover:opacity-85"
        >
          Back to Today
        </Link>
      </div>
    </main>
  );
}
