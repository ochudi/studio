"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Archive keeps history intact and hides the client from active lists;
 * there is no hard delete. Two taps required, never one.
 */
export default function ArchiveControl({
  clientId,
  archived,
}: {
  clientId: string;
  archived: boolean;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  async function run() {
    if (busy) return;
    setBusy(true);
    await fetch(`/api/clients/${clientId}`, {
      method: archived ? "PATCH" : "DELETE",
      headers: archived ? { "content-type": "application/json" } : undefined,
      body: archived ? JSON.stringify({ unarchive: true }) : undefined,
    }).catch(() => null);
    router.push(`/clients/${clientId}`);
    router.refresh();
  }

  const linkClass =
    "font-mono text-fluid-xs uppercase tracking-[0.18em] text-muted transition-colors hover:text-fg disabled:opacity-40";

  return (
    <div className="flex items-center gap-6">
      {archived ? (
        <button type="button" disabled={busy} onClick={run} className={linkClass}>
          {busy ? "Restoring" : "Restore from archive"}
        </button>
      ) : confirming ? (
        <>
          <span className="font-mono text-fluid-xs uppercase tracking-[0.18em] text-muted">
            History stays; the client leaves active lists.
          </span>
          <button type="button" disabled={busy} onClick={run} className={linkClass}>
            {busy ? "Archiving" : "Confirm archive"}
          </button>
          <button type="button" onClick={() => setConfirming(false)} className={linkClass}>
            Cancel
          </button>
        </>
      ) : (
        <button type="button" onClick={() => setConfirming(true)} className={linkClass}>
          Archive client
        </button>
      )}
    </div>
  );
}
