"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PAYMENT_METHODS, labelFor, type Payment } from "@/lib/domain";
import { parseToMinor, formatMinor } from "@/lib/money";
import {
  TextField,
  SelectField,
  SubmitButton,
  FormError,
} from "@/components/fields";

/**
 * Money against an invoice: the list of what's landed and a quick form for
 * the next one. Amount defaults to the open balance because most payments
 * settle, not trickle.
 */

const receivedFmt = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "Africa/Lagos",
});

function lagosToday(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Lagos" }).format(new Date());
}

function PaymentRow({ payment: p }: { payment: Payment }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);

  async function remove() {
    if (busy) return;
    setBusy(true);
    await fetch(`/api/payments/${p.id}`, { method: "DELETE" }).catch(() => null);
    setBusy(false);
    setConfirming(false);
    router.refresh();
  }

  const linkClass =
    "font-mono text-[10px] uppercase tracking-[0.16em] text-muted transition-colors hover:text-fg disabled:opacity-40 sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100 sm:focus-visible:opacity-100";

  return (
    <li className="group flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 py-3.5">
      <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
        <p className="tnum text-fluid-sm">{formatMinor(Number(p.amount_minor), p.currency)}</p>
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
          {receivedFmt.format(new Date(p.received_at + "T12:00:00Z"))} ·{" "}
          {labelFor(PAYMENT_METHODS, p.method)}
          {p.reference ? ` · ${p.reference}` : ""}
        </p>
      </div>
      {confirming ? (
        <span className="flex items-center gap-3">
          <button type="button" disabled={busy} onClick={remove} className={linkClass}>
            Really delete
          </button>
          <button type="button" onClick={() => setConfirming(false)} className={linkClass}>
            Keep
          </button>
        </span>
      ) : (
        <button type="button" onClick={() => setConfirming(true)} className={linkClass}>
          Delete
        </button>
      )}
    </li>
  );
}

export default function PaymentSection({
  invoiceId,
  clientId,
  currency,
  balanceMinor,
  payments,
  open: canRecord,
}: {
  invoiceId: string;
  clientId: string;
  currency: string;
  balanceMinor: number;
  payments: Payment[];
  open: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [receivedAt, setReceivedAt] = useState(lagosToday());
  const [method, setMethod] = useState("bank_transfer");
  const [reference, setReference] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function openForm() {
    setAmount(balanceMinor > 0 ? (balanceMinor / 100).toLocaleString("en", { maximumFractionDigits: 2 }) : "");
    setOpen(true);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;

    const minor = parseToMinor(amount);
    if (minor === null || minor <= 0) {
      setError("The amount doesn't read as money.");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/payments", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          client_id: clientId,
          invoice_id: invoiceId,
          amount_minor: minor,
          currency,
          received_at: receivedAt,
          method,
          reference: reference || null,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error ?? "That didn't save. Try again.");
        setBusy(false);
        return;
      }
      setOpen(false);
      setBusy(false);
      setReference("");
      router.refresh();
    } catch {
      setError("Network hiccup. Try again.");
      setBusy(false);
    }
  }

  return (
    <div>
      {payments.length > 0 && (
        <ul className="divide-y divide-line border-y border-line">
          {payments.map((p) => (
            <PaymentRow key={p.id} payment={p} />
          ))}
        </ul>
      )}

      {open ? (
        <form
          onSubmit={onSubmit}
          className={`rounded-lg border border-line bg-raised p-5 md:p-6 ${payments.length > 0 ? "mt-5" : ""}`}
        >
          <div className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2">
            <TextField
              id="pay-amount"
              label={`Amount · ${currency}`}
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
              autoFocus
            />
            <TextField
              id="pay-date"
              label="Received"
              type="date"
              value={receivedAt}
              onChange={(e) => setReceivedAt(e.target.value)}
              required
            />
            <SelectField
              id="pay-method"
              label="Method"
              options={PAYMENT_METHODS}
              value={method}
              onChange={(e) => setMethod(e.target.value)}
            />
            <TextField
              id="pay-reference"
              label="Reference (optional)"
              placeholder="Transfer ref, last four digits"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
            />
          </div>
          <div className="mt-6 flex flex-wrap items-center gap-5">
            <SubmitButton busy={busy}>{busy ? "Saving" : "Record it"}</SubmitButton>
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
      ) : canRecord ? (
        <button
          type="button"
          onClick={openForm}
          className={`font-mono text-[10px] uppercase tracking-[0.18em] text-muted transition-colors hover:text-fg ${payments.length > 0 ? "mt-5" : ""}`}
        >
          + Record payment
        </button>
      ) : payments.length === 0 ? (
        <p className="text-fluid-xs text-muted">Nothing yet.</p>
      ) : null}
    </div>
  );
}
