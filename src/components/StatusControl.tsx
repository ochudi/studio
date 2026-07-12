"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PROJECT_STATUSES } from "@/lib/domain";

/**
 * The stage, changeable in place. A select dressed as a chip: pick the new
 * stage and it saves — lifecycle dates follow on the server.
 */
export default function StatusControl({
  projectId,
  status,
}: {
  projectId: string;
  status: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    if (busy) return;
    setBusy(true);
    await fetch(`/api/projects/${projectId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: e.target.value }),
    }).catch(() => null);
    setBusy(false);
    router.refresh();
  }

  return (
    <select
      aria-label="Project stage"
      value={status}
      onChange={onChange}
      disabled={busy}
      className="cursor-pointer appearance-none rounded-full border border-line bg-fg px-3.5 py-1.5 text-center font-mono text-[10px] uppercase tracking-[0.16em] text-bg outline-none transition-opacity hover:opacity-85 disabled:opacity-40"
    >
      {PROJECT_STATUSES.map((s) => (
        <option key={s.value} value={s.value}>
          {s.label}
        </option>
      ))}
    </select>
  );
}
