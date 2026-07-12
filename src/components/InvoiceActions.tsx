"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

/**
 * The lifecycle, as buttons. Order lives on the server; these just ask.
 * Everything irreversible takes two taps.
 */
export default function InvoiceActions({ invoiceId, status }: { invoiceId: string; status: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState<"delete" | "void" | "written_off" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function call(method: "PATCH" | "DELETE", body?: object) {
    if (busy) return;
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/invoices/${invoiceId}`, {
      method,
      headers: body ? { "content-type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    }).catch(() => null);
    const data = await res?.json().catch(() => null);
    setBusy(false);
    setConfirming(null);
    if (!res?.ok) {
      setError(data?.error ?? "That didn't work. Try again.");
      return;
    }
    if (method === "DELETE") {
      router.push("/money");
    }
    router.refresh();
  }

  const primaryClass =
    "inline-flex items-center rounded-full bg-fg px-5 py-2.5 font-mono text-fluid-xs uppercase tracking-[0.18em] text-bg transition-opacity duration-300 hover:opacity-85 disabled:opacity-40";
  const quietClass =
    "inline-flex items-center rounded-full border border-line px-5 py-2.5 font-mono text-fluid-xs uppercase tracking-[0.18em] text-fg transition-colors duration-300 hover:border-fg disabled:opacity-40";
  const linkClass =
    "font-mono text-[10px] uppercase tracking-[0.16em] text-muted transition-colors hover:text-fg disabled:opacity-40";

  return (
    <div className="flex flex-wrap items-center gap-3">
      {status === "draft" && (
        <>
          <button type="button" disabled={busy} onClick={() => call("PATCH", { status: "sent" })} className={primaryClass}>
            Mark sent
          </button>
          <Link href={`/money/invoices/${invoiceId}/edit`} className={quietClass}>
            Edit
          </Link>
        </>
      )}
      <a href={`/api/invoices/${invoiceId}/pdf`} target="_blank" rel="noreferrer" className={quietClass}>
        PDF
      </a>

      {status === "draft" &&
        (confirming === "delete" ? (
          <span className="flex items-center gap-3">
            <button type="button" disabled={busy} onClick={() => call("DELETE")} className={linkClass}>
              Really delete
            </button>
            <button type="button" onClick={() => setConfirming(null)} className={linkClass}>
              Keep
            </button>
          </span>
        ) : (
          <button type="button" onClick={() => setConfirming("delete")} className={linkClass}>
            Delete
          </button>
        ))}

      {status === "sent" &&
        (confirming === "void" ? (
          <span className="flex items-center gap-3">
            <button type="button" disabled={busy} onClick={() => call("PATCH", { status: "void" })} className={linkClass}>
              Really void
            </button>
            <button type="button" onClick={() => setConfirming(null)} className={linkClass}>
              Keep
            </button>
          </span>
        ) : (
          <button type="button" onClick={() => setConfirming("void")} className={linkClass}>
            Void
          </button>
        ))}

      {(status === "sent" || status === "partially_paid") &&
        (confirming === "written_off" ? (
          <span className="flex items-center gap-3">
            <button
              type="button"
              disabled={busy}
              onClick={() => call("PATCH", { status: "written_off" })}
              className={linkClass}
            >
              Really write off
            </button>
            <button type="button" onClick={() => setConfirming(null)} className={linkClass}>
              Keep
            </button>
          </span>
        ) : (
          <button type="button" onClick={() => setConfirming("written_off")} className={linkClass}>
            Write off
          </button>
        ))}

      {error && (
        <p role="alert" className="w-full text-fluid-xs text-muted">
          {error}
        </p>
      )}
    </div>
  );
}
