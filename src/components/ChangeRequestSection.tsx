"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CR_STATUSES, labelFor, type ChangeRequest } from "@/lib/domain";
import { CURRENCIES, parseToMinor, formatMinor } from "@/lib/money";
import Chip from "@/components/Chip";
import {
  TextField,
  TextAreaField,
  SelectField,
  SubmitButton,
  FormError,
} from "@/components/fields";

/**
 * Scope-creep protection: what changes, why, and what it does to timeline
 * and price — drafted, sent, then approved or rejected. Work starts after
 * approval, not before; the server enforces the order.
 */

const CURRENCY_OPTIONS = CURRENCIES.map((c) => ({ value: c, label: c }));

function CRRow({ cr }: { cr: ChangeRequest }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);

  async function call(method: "PATCH" | "DELETE", body?: object) {
    if (busy) return;
    setBusy(true);
    await fetch(`/api/change-requests/${cr.id}`, {
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

  const impacts = [
    cr.timeline_impact,
    cr.price_impact_minor != null && cr.currency
      ? `${cr.price_impact_minor >= 0 ? "+" : "-"}${formatMinor(Math.abs(cr.price_impact_minor), cr.currency)}`
      : null,
  ].filter(Boolean);

  return (
    <li className="py-4">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1.5">
        <p className="text-fluid-sm">{cr.title}</p>
        <Chip filled={cr.status === "approved"}>{labelFor(CR_STATUSES, cr.status)}</Chip>
        {impacts.length > 0 && (
          <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
            {impacts.join(" · ")}
          </span>
        )}
      </div>
      <p className="mt-1 max-w-[64ch] text-fluid-xs leading-relaxed text-muted">
        {cr.what_changes}
        {cr.why ? ` — ${cr.why}` : ""}
      </p>
      <div className="mt-2 flex items-center gap-4">
        {cr.status === "draft" && (
          <>
            <button type="button" disabled={busy} onClick={() => call("PATCH", { status: "sent" })} className={linkClass}>
              Mark sent
            </button>
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
          </>
        )}
        {cr.status === "sent" && (
          <>
            <button type="button" disabled={busy} onClick={() => call("PATCH", { status: "approved" })} className={linkClass}>
              Approved
            </button>
            <button type="button" disabled={busy} onClick={() => call("PATCH", { status: "rejected" })} className={linkClass}>
              Rejected
            </button>
          </>
        )}
        {cr.status === "rejected" && (
          <button type="button" disabled={busy} onClick={() => call("PATCH", { status: "sent" })} className={linkClass}>
            Re-send
          </button>
        )}
      </div>
    </li>
  );
}

export default function ChangeRequestSection({
  projectId,
  requests,
  currency,
}: {
  projectId: string;
  requests: ChangeRequest[];
  currency: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [whatChanges, setWhatChanges] = useState("");
  const [why, setWhy] = useState("");
  const [timelineImpact, setTimelineImpact] = useState("");
  const [priceImpact, setPriceImpact] = useState("");
  const [crCurrency, setCrCurrency] = useState(currency);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;

    const trimmedPrice = priceImpact.trim().replace(/^[+-]/, "");
    const minor = trimmedPrice ? parseToMinor(trimmedPrice) : null;
    if (trimmedPrice && minor === null) {
      setError("The price impact doesn't read as money.");
      return;
    }
    const signed = minor === null ? null : priceImpact.trim().startsWith("-") ? -minor : minor;

    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/change-requests", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          project_id: projectId,
          title,
          what_changes: whatChanges,
          why: why || null,
          timeline_impact: timelineImpact || null,
          price_impact_minor: signed,
          currency: signed === null ? null : crCurrency,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error ?? "That didn't save. Try again.");
        setBusy(false);
        return;
      }
      setTitle("");
      setWhatChanges("");
      setWhy("");
      setTimelineImpact("");
      setPriceImpact("");
      setOpen(false);
      setBusy(false);
      router.refresh();
    } catch {
      setError("Network hiccup. Try again.");
      setBusy(false);
    }
  }

  return (
    <div>
      {requests.length > 0 && (
        <ul className="divide-y divide-line border-y border-line">
          {requests.map((cr) => (
            <CRRow key={cr.id} cr={cr} />
          ))}
        </ul>
      )}

      {open ? (
        <form
          onSubmit={onSubmit}
          className={`rounded-lg border border-line bg-raised p-5 md:p-6 ${requests.length > 0 ? "mt-5" : ""}`}
        >
          <div className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2">
            <TextField
              id="cr-title"
              label="Change"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Add a booking page"
              required
              autoFocus
            />
            <TextField
              id="cr-timeline"
              label="Timeline impact"
              value={timelineImpact}
              onChange={(e) => setTimelineImpact(e.target.value)}
              placeholder="+1 week"
            />
            <TextAreaField
              id="cr-what"
              label="What changes"
              rows={2}
              value={whatChanges}
              onChange={(e) => setWhatChanges(e.target.value)}
              required
              className="sm:col-span-2"
            />
            <TextField
              id="cr-why"
              label="Why (optional)"
              value={why}
              onChange={(e) => setWhy(e.target.value)}
            />
            <div className="grid grid-cols-[1fr_auto] items-end gap-4">
              <TextField
                id="cr-price"
                label="Price impact"
                inputMode="decimal"
                placeholder="50,000 or -20,000"
                value={priceImpact}
                onChange={(e) => setPriceImpact(e.target.value)}
              />
              <SelectField
                id="cr-currency"
                label="&nbsp;"
                aria-label="Currency"
                options={CURRENCY_OPTIONS}
                value={crCurrency}
                onChange={(e) => setCrCurrency(e.target.value)}
                className="w-20"
              />
            </div>
          </div>
          <div className="mt-6 flex flex-wrap items-center gap-5">
            <SubmitButton busy={busy}>{busy ? "Saving" : "Save draft"}</SubmitButton>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted transition-colors hover:text-fg"
            >
              Cancel
            </button>
            <FormError error={error} />
          </div>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={`font-mono text-[10px] uppercase tracking-[0.18em] text-muted transition-colors hover:text-fg ${requests.length > 0 ? "mt-5" : ""}`}
        >
          + New change request
        </button>
      )}
    </div>
  );
}
