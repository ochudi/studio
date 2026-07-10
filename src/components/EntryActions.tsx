"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/** Row-level actions on a log entry: settle its follow-up, or remove it. */
export default function EntryActions({
  id,
  hasFollowUp,
}: {
  id: string;
  hasFollowUp: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);

  async function call(method: "PATCH" | "DELETE", body?: object) {
    if (busy) return;
    setBusy(true);
    await fetch(`/api/correspondence/${id}`, {
      method,
      headers: body ? { "content-type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    }).catch(() => null);
    setBusy(false);
    setConfirming(false);
    router.refresh();
  }

  const linkClass =
    "font-mono text-[10px] uppercase tracking-[0.16em] text-muted transition-colors hover:text-fg disabled:opacity-40";

  return (
    <span className="flex shrink-0 items-center gap-4">
      {hasFollowUp && (
        <button type="button" disabled={busy} onClick={() => call("PATCH", { follow_up_done: true })} className={linkClass}>
          Done
        </button>
      )}
      {confirming ? (
        <>
          <button type="button" disabled={busy} onClick={() => call("DELETE")} className={linkClass}>
            Really delete
          </button>
          <button type="button" onClick={() => setConfirming(false)} className={linkClass}>
            Keep
          </button>
        </>
      ) : (
        <button type="button" onClick={() => setConfirming(true)} className={linkClass}>
          Delete
        </button>
      )}
    </span>
  );
}
