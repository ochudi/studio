"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

/**
 * The event lifecycle as buttons. Marking done asks for the outcome in the
 * same breath — the note is worth most while the call is still ringing in
 * your ears. Everything irreversible takes two taps.
 */
export default function EventActions({
  eventId,
  status,
  outcome,
  clientId,
  clientName,
  clientEmail,
}: {
  eventId: string;
  status: string;
  outcome: string | null;
  clientId: string | null;
  clientName: string | null;
  clientEmail: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState<"cancel" | "no_show" | "delete" | "invite" | null>(null);
  const [noting, setNoting] = useState(false);
  const [note, setNote] = useState(outcome ?? "");
  const [error, setError] = useState<string | null>(null);

  async function call(input: RequestInfo, init: RequestInit, goTo?: string) {
    if (busy) return null;
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

  const close = (status: string, outcome?: string) =>
    call(`/api/events/${eventId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status, outcome: outcome || null }),
    });

  const primaryClass =
    "inline-flex items-center rounded-full bg-fg px-5 py-2.5 font-mono text-fluid-xs uppercase tracking-[0.18em] text-bg transition-opacity duration-300 hover:opacity-85 disabled:opacity-40";
  const quietClass =
    "inline-flex items-center rounded-full border border-line px-5 py-2.5 font-mono text-fluid-xs uppercase tracking-[0.18em] text-fg transition-colors duration-300 hover:border-fg disabled:opacity-40";
  const linkClass =
    "font-mono text-[10px] uppercase tracking-[0.16em] text-muted transition-colors hover:text-fg disabled:opacity-40";

  const twoTap = (
    key: "cancel" | "no_show" | "delete" | "invite",
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

  if (noting) {
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void close("done", note).then((d) => d && setNoting(false));
        }}
        className="max-w-xl"
      >
        <label
          htmlFor="outcome"
          className="block font-mono text-[10px] uppercase tracking-[0.22em] text-muted"
        >
          What came out of it
        </label>
        <textarea
          id="outcome"
          rows={3}
          autoFocus
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Decisions, promises, next steps. Blank is allowed, regret is likely."
          className="mt-2 w-full resize-y border-b border-line bg-transparent pb-2 text-fluid-base leading-relaxed outline-none transition-colors focus:border-fg placeholder:text-muted/60"
        />
        <div className="mt-4 flex items-center gap-4">
          <button type="submit" disabled={busy} className={primaryClass}>
            {status === "done" ? "Save outcome" : "Mark done"}
          </button>
          <button type="button" onClick={() => setNoting(false)} className={linkClass}>
            Back
          </button>
        </div>
        {error && (
          <p role="alert" className="mt-3 text-fluid-xs text-muted">
            {error}
          </p>
        )}
      </form>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      {status === "scheduled" && (
        <>
          <button type="button" disabled={busy} onClick={() => setNoting(true)} className={primaryClass}>
            Mark done
          </button>
          <Link href={`/calendar/${eventId}/edit`} className={quietClass}>
            Edit
          </Link>
        </>
      )}

      <a href={`/api/events/${eventId}/ics`} className={quietClass}>
        Add to calendar
      </a>

      {status === "scheduled" &&
        clientEmail &&
        twoTap(
          "invite",
          "Email invite",
          `Send to ${clientName ?? "the client"}`,
          () => void call(`/api/events/${eventId}/invite`, { method: "POST" }),
          quietClass
        )}

      {status === "done" && (
        <>
          {clientId && (
            <Link href={`/clients/${clientId}`} className={quietClass}>
              Log the conversation
            </Link>
          )}
          <button type="button" disabled={busy} onClick={() => setNoting(true)} className={linkClass}>
            {outcome ? "Edit outcome" : "Add outcome"}
          </button>
        </>
      )}

      {status === "scheduled" && (
        <>
          {twoTap("no_show", "No-show", "Really a no-show", () => void close("no_show"))}
          {twoTap("cancel", "Cancel event", "Really cancel", () => void close("cancelled"))}
          {twoTap("delete", "Delete", "Really delete", () =>
            void call(`/api/events/${eventId}`, { method: "DELETE" }, "/calendar")
          )}
        </>
      )}

      {error && (
        <p role="alert" className="w-full text-fluid-xs text-muted">
          {error}
        </p>
      )}
    </div>
  );
}
