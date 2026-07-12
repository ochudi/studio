"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CURRENCIES, parseToMinor } from "@/lib/money";
import { PAYMENT_METHODS } from "@/lib/domain";
import {
  TextField,
  SelectField,
  TextAreaField,
  SubmitButton,
  FormError,
} from "@/components/fields";

/**
 * Money that lands outside an invoice: a deposit agreed on a call, cash in
 * hand, work that predates the tool. It still counts everywhere an invoice
 * payment does.
 */

export type PayClientOption = { value: string; label: string; currency: string };
export type PayProjectOption = { id: string; client_id: string; name: string };

const CURRENCY_OPTIONS = CURRENCIES.map((c) => ({ value: c, label: c }));

function lagosToday(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Lagos" }).format(new Date());
}

export default function StandalonePaymentForm({
  clients,
  projects,
  presetClient,
  presetProject,
}: {
  clients: PayClientOption[];
  projects: PayProjectOption[];
  presetClient?: string;
  presetProject?: string;
}) {
  const router = useRouter();
  const preset = clients.find((c) => c.value === presetClient);

  const [clientId, setClientId] = useState(presetClient ?? "");
  const [projectId, setProjectId] = useState(presetProject ?? "");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState(preset?.currency ?? "NGN");
  const [receivedAt, setReceivedAt] = useState(lagosToday());
  const [method, setMethod] = useState("bank_transfer");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const clientOptions = clientId ? clients : [{ value: "", label: "Pick a client", currency: "NGN" }, ...clients];
  const projectOptions = [
    { value: "", label: "No project" },
    ...projects.filter((p) => p.client_id === clientId).map((p) => ({ value: p.id, label: p.name })),
  ];

  function onClientChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const id = e.target.value;
    setClientId(id);
    setProjectId("");
    const c = clients.find((opt) => opt.value === id);
    if (c) setCurrency(c.currency);
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
          project_id: projectId || null,
          amount_minor: minor,
          currency,
          received_at: receivedAt,
          method,
          reference: reference || null,
          notes: notes || null,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error ?? "That didn't save. Try again.");
        setBusy(false);
        return;
      }
      router.push("/money");
      router.refresh();
    } catch {
      setError("Network hiccup. Try again.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="max-w-2xl">
      <section className="grid grid-cols-1 gap-x-10 gap-y-7 sm:grid-cols-2">
        <SelectField
          id="pay-client"
          label="Client"
          options={clientOptions}
          value={clientId}
          onChange={onClientChange}
          required
        />
        <SelectField
          id="pay-project"
          label="Project"
          options={projectOptions}
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
        />
        <div className="grid grid-cols-[1fr_auto] items-end gap-4">
          <TextField
            id="pay-amount"
            label="Amount"
            inputMode="decimal"
            placeholder="175,000"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
          />
          <SelectField
            id="pay-currency"
            label="&nbsp;"
            aria-label="Currency"
            options={CURRENCY_OPTIONS}
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            className="w-20"
          />
        </div>
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
        <TextAreaField
          id="pay-notes"
          label="Notes"
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="sm:col-span-2"
        />
      </section>

      <div className="mt-10 flex items-center gap-5">
        <SubmitButton busy={busy}>{busy ? "Saving" : "Record it"}</SubmitButton>
        <FormError error={error} />
      </div>
    </form>
  );
}
