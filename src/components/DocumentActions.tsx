"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

/**
 * The document lifecycle as buttons. Marking sent freezes the as-sent PDF;
 * everything irreversible takes two taps. The signed-scan upload lives here
 * because it belongs to the moment, not to a settings page.
 */
export default function DocumentActions({
  documentId,
  status,
  title,
  clientId,
  projectId,
  kind,
}: {
  documentId: string;
  status: string;
  title: string;
  clientId: string | null;
  projectId: string | null;
  kind: string;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState<"send" | "delete" | "archive" | "signed" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function call(input: RequestInfo, init: RequestInit, goTo?: string) {
    if (busy) return;
    setBusy(true);
    setError(null);
    const res = await fetch(input, init).catch(() => null);
    const data = await res?.json().catch(() => null);
    setBusy(false);
    setConfirming(null);
    if (!res?.ok) {
      setError(data?.error ?? "That didn't work. Try again.");
      return null;
    }
    if (goTo) router.push(goTo);
    router.refresh();
    return data;
  }

  const patchStatus = (status: string) =>
    call(`/api/documents/${documentId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status }),
    });

  async function duplicate() {
    const data = await call("/api/documents", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        duplicate_of: documentId,
        kind,
        title: `${title} · revision`,
        client_id: clientId,
        project_id: projectId,
      }),
    });
    if (data?.id) router.push(`/documents/${data.id}/edit`);
  }

  async function onSignedFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const form = new FormData();
    form.set("file", file);
    await call(`/api/documents/${documentId}/signed`, { method: "POST", body: form });
    if (fileRef.current) fileRef.current.value = "";
  }

  const primaryClass =
    "inline-flex items-center rounded-full bg-fg px-5 py-2.5 font-mono text-fluid-xs uppercase tracking-[0.18em] text-bg transition-opacity duration-300 hover:opacity-85 disabled:opacity-40";
  const quietClass =
    "inline-flex items-center rounded-full border border-line px-5 py-2.5 font-mono text-fluid-xs uppercase tracking-[0.18em] text-fg transition-colors duration-300 hover:border-fg disabled:opacity-40";
  const linkClass =
    "font-mono text-[10px] uppercase tracking-[0.16em] text-muted transition-colors hover:text-fg disabled:opacity-40";

  const twoTap = (
    key: "send" | "delete" | "archive" | "signed",
    idleLabel: string,
    confirmLabel: string,
    action: () => void,
    className = linkClass
  ) =>
    confirming === key ? (
      <span className="flex items-center gap-3">
        <button type="button" disabled={busy} onClick={action} className={linkClass}>
          {confirmLabel}
        </button>
        <button type="button" onClick={() => setConfirming(null)} className={linkClass}>
          Keep
        </button>
      </span>
    ) : (
      <button type="button" disabled={busy} onClick={() => setConfirming(key)} className={className}>
        {idleLabel}
      </button>
    );

  return (
    <div className="flex flex-wrap items-center gap-3">
      {status === "draft" && (
        <>
          {twoTap("send", "Mark sent", "Freeze as sent", () => patchStatus("sent"), primaryClass)}
          <Link href={`/documents/${documentId}/edit`} className={quietClass}>
            Edit
          </Link>
        </>
      )}

      <a href={`/api/documents/${documentId}/pdf`} target="_blank" rel="noreferrer" className={quietClass}>
        PDF
      </a>
      <a href={`/api/documents/${documentId}/docx`} className={quietClass}>
        DOCX
      </a>

      {status === "sent" && (
        <>
          <button type="button" disabled={busy} onClick={() => fileRef.current?.click()} className={quietClass}>
            Upload signed
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/pdf,image/*"
            aria-label="Signed copy"
            onChange={onSignedFile}
            className="sr-only"
          />
          {twoTap("signed", "Mark signed", "Really mark signed", () => patchStatus("signed"))}
        </>
      )}

      {status !== "draft" && (
        <button type="button" disabled={busy} onClick={duplicate} className={linkClass}>
          Duplicate
        </button>
      )}

      {status === "draft" &&
        twoTap("delete", "Delete", "Really delete", () =>
          call(`/api/documents/${documentId}`, { method: "DELETE" }, "/documents")
        )}
      {(status === "sent" || status === "signed") &&
        twoTap("archive", "Archive", "Really archive", () => patchStatus("archived"))}

      {error && (
        <p role="alert" className="w-full text-fluid-xs text-muted">
          {error}
        </p>
      )}
    </div>
  );
}
