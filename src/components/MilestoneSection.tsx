"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { clsx } from "clsx";
import type { Milestone } from "@/lib/domain";
import Chip from "@/components/Chip";
import { TextField, SubmitButton, FormError } from "@/components/fields";

/**
 * The delivery timeline: milestones in order, checked off as they land.
 * Overdue ones carry a filled chip — these feed the nudge queue later.
 */

const dueFmt = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  timeZone: "Africa/Lagos",
});

function lagosToday(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Lagos" }).format(new Date());
}

function MilestoneRow({ m }: { m: Milestone }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const done = !!m.completed_at;
  const overdue = !done && !!m.due_date && m.due_date <= lagosToday();

  async function call(method: "PATCH" | "DELETE", body?: object) {
    if (busy) return;
    setBusy(true);
    await fetch(`/api/milestones/${m.id}`, {
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
    <li className="group/ms flex items-baseline gap-4 py-3.5">
      <button
        type="button"
        role="checkbox"
        aria-checked={done}
        aria-label={done ? `Reopen ${m.title}` : `Mark ${m.title} done`}
        disabled={busy}
        onClick={() => call("PATCH", { done: !done })}
        className={clsx(
          "mt-0.5 h-4 w-4 shrink-0 self-center rounded-full border transition-colors disabled:opacity-40",
          done ? "border-fg bg-fg" : "border-line hover:border-fg"
        )}
      />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1.5">
          <p className={clsx("text-fluid-sm", done && "text-muted line-through decoration-line")}>
            {m.title}
          </p>
          {m.due_date && !done && (
            <Chip filled={overdue}>
              {overdue ? "Due · " : ""}
              {dueFmt.format(new Date(m.due_date + "T12:00:00Z"))}
            </Chip>
          )}
        </div>
        {m.description && (
          <p className="mt-1 max-w-[56ch] text-fluid-xs leading-relaxed text-muted">
            {m.description}
          </p>
        )}
      </div>
      {/* Always visible on touch screens; hover-revealed on desktop. */}
      <span className="flex shrink-0 items-center gap-4 transition-opacity focus-within:opacity-100 group-hover/ms:opacity-100 sm:opacity-0">
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
    </li>
  );
}

export default function MilestoneSection({
  projectId,
  milestones,
}: {
  projectId: string;
  milestones: Milestone[];
}) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/milestones", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          project_id: projectId,
          title,
          due_date: dueDate || null,
          sort_order: milestones.length,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error ?? "That didn't save. Try again.");
        setBusy(false);
        return;
      }
      setTitle("");
      setDueDate("");
      setBusy(false);
      router.refresh();
    } catch {
      setError("Network hiccup. Try again.");
      setBusy(false);
    }
  }

  return (
    <div>
      {milestones.length > 0 && (
        <ul className="divide-y divide-line border-y border-line">
          {milestones.map((m) => (
            <MilestoneRow key={m.id} m={m} />
          ))}
        </ul>
      )}
      <form
        onSubmit={onSubmit}
        className={clsx(
          "flex flex-wrap items-end gap-x-6 gap-y-4",
          milestones.length > 0 && "mt-5"
        )}
      >
        <TextField
          id="ms-title"
          label="Add a milestone"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Homepage design review"
          required
          className="min-w-0 flex-1 basis-56"
        />
        <TextField
          id="ms-due"
          label="Due"
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          className="w-40"
        />
        <SubmitButton busy={busy} className="px-5 py-2.5">
          {busy ? "Saving" : "Add"}
        </SubmitButton>
        <FormError error={error} />
      </form>
    </div>
  );
}
