"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { EXPENSE_CATEGORIES, labelFor, type Expense } from "@/lib/domain";
import { formatMinor } from "@/lib/money";
import Chip from "@/components/Chip";

/**
 * Expense rows, shared by the ledger and the project page. Receipts open in
 * a new tab through a short-lived signed URL; deletes take the receipt too.
 */

export type ExpenseRowData = Expense & { studio_projects?: { name: string } | null };

const dayFmt = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  timeZone: "Africa/Lagos",
});

function ExpenseRow({ expense: x, showProject }: { expense: ExpenseRowData; showProject: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);

  async function remove() {
    if (busy) return;
    setBusy(true);
    await fetch(`/api/expenses/${x.id}`, { method: "DELETE" }).catch(() => null);
    setBusy(false);
    setConfirming(false);
    router.refresh();
  }

  const linkClass =
    "font-mono text-[10px] uppercase tracking-[0.16em] text-muted transition-colors hover:text-fg disabled:opacity-40";
  const revealClass =
    linkClass + " sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100 sm:focus-visible:opacity-100";

  const meta = [
    dayFmt.format(new Date(x.spent_at + "T12:00:00Z")),
    labelFor(EXPENSE_CATEGORIES, x.category),
    showProject ? x.studio_projects?.name ?? null : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <li className="group flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 px-2 py-3.5">
      <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
        <p className="tnum text-fluid-sm">{formatMinor(Number(x.amount_minor), x.currency)}</p>
        <p className="min-w-0 truncate text-fluid-sm text-muted">{x.title}</p>
        {x.billable && <Chip>Billable</Chip>}
      </div>
      <div className="flex items-baseline gap-4">
        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted">{meta}</span>
        {x.receipt_document_id && (
          <a
            href={`/api/receipts/${x.receipt_document_id}`}
            target="_blank"
            rel="noreferrer"
            className={linkClass}
          >
            Receipt
          </a>
        )}
        {confirming ? (
          <span className="flex items-baseline gap-3">
            <button type="button" disabled={busy} onClick={remove} className={linkClass}>
              Really delete
            </button>
            <button type="button" onClick={() => setConfirming(false)} className={linkClass}>
              Keep
            </button>
          </span>
        ) : (
          <button type="button" onClick={() => setConfirming(true)} className={revealClass}>
            Delete
          </button>
        )}
      </div>
    </li>
  );
}

export default function ExpenseSection({
  expenses,
  showProject = false,
  emptyText,
}: {
  expenses: ExpenseRowData[];
  showProject?: boolean;
  emptyText: string;
}) {
  if (expenses.length === 0) {
    return <p className="text-fluid-xs text-muted">{emptyText}</p>;
  }
  return (
    <ul className="divide-y divide-line border-y border-line">
      {expenses.map((x) => (
        <ExpenseRow key={x.id} expense={x} showProject={showProject} />
      ))}
    </ul>
  );
}
