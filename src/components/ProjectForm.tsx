"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CURRENCIES, parseToMinor } from "@/lib/money";
import {
  PROJECT_KINDS,
  PROJECT_STATUSES,
  PRICING_MODELS,
  type Project,
} from "@/lib/domain";
import {
  TextField,
  SelectField,
  TextAreaField,
  SubmitButton,
  FormError,
} from "@/components/fields";

/**
 * Create and edit in one form. On create it doubles as the backfill flow:
 * pick the real status and record what's already been collected — the money
 * lands as a standalone payment so nothing assumes a clean start.
 */

type ClientOption = { value: string; label: string };

type Values = {
  client_id: string;
  name: string;
  kind: string;
  status: string;
  pricing_model: string;
  description: string;
  quoted: string;
  currency: string;
  start_date: string;
  due_date: string;
  notes: string;
  collected: string;
};

function fromProject(p?: Project, presetClient?: string): Values {
  return {
    client_id: p?.client_id ?? presetClient ?? "",
    name: p?.name ?? "",
    kind: p?.kind ?? "design_development",
    status: p?.status ?? "lead",
    pricing_model: p?.pricing_model ?? "fixed",
    description: p?.description ?? "",
    quoted: p?.quoted_minor
      ? (p.quoted_minor / 100).toLocaleString("en", { maximumFractionDigits: 2 })
      : "",
    currency: p?.currency ?? "NGN",
    start_date: p?.start_date ?? "",
    due_date: p?.due_date ?? "",
    notes: p?.notes ?? "",
    collected: "",
  };
}

const CURRENCY_OPTIONS = CURRENCIES.map((c) => ({ value: c, label: c }));

export default function ProjectForm({
  project,
  clients,
  presetClient,
}: {
  project?: Project;
  clients: ClientOption[];
  presetClient?: string;
}) {
  const router = useRouter();
  const [v, setV] = useState<Values>(() => fromProject(project, presetClient));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const set = (key: keyof Values) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => setV((prev) => ({ ...prev, [key]: e.target.value }));

  const clientOptions = v.client_id
    ? clients
    : [{ value: "", label: "Pick a client" }, ...clients];

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;

    const quoted = v.quoted.trim() ? parseToMinor(v.quoted) : null;
    if (v.quoted.trim() && quoted === null) {
      setError("The quote doesn't read as an amount.");
      return;
    }
    const collected = v.collected.trim() ? parseToMinor(v.collected) : null;
    if (v.collected.trim() && collected === null) {
      setError("The collected amount doesn't read as money.");
      return;
    }

    setBusy(true);
    setError(null);

    const payload = {
      client_id: v.client_id,
      name: v.name,
      kind: v.kind,
      status: v.status,
      pricing_model: v.pricing_model,
      description: v.description || null,
      quoted_minor: quoted,
      currency: v.currency,
      start_date: v.start_date || null,
      due_date: v.due_date || null,
      notes: v.notes || null,
      ...(project ? {} : { collected_minor: collected }),
    };

    try {
      const res = await fetch(project ? `/api/projects/${project.id}` : "/api/projects", {
        method: project ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error ?? "That didn't save. Try again.");
        setBusy(false);
        return;
      }
      router.push(`/projects/${project ? project.id : data.id}`);
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
          id="client_id"
          label="Client"
          options={clientOptions}
          value={v.client_id}
          onChange={set("client_id")}
          required
        />
        <TextField id="name" label="Project name" value={v.name} onChange={set("name")} required />
        <SelectField id="kind" label="Kind" options={PROJECT_KINDS} value={v.kind} onChange={set("kind")} />
        <SelectField id="status" label="Stage" options={PROJECT_STATUSES} value={v.status} onChange={set("status")} />
        <TextAreaField
          id="description"
          label="What it is"
          rows={2}
          value={v.description}
          onChange={set("description")}
          className="sm:col-span-2"
        />
      </section>

      <section className="mt-10 grid grid-cols-1 gap-x-10 gap-y-7 border-t border-line pt-8 sm:grid-cols-2">
        <SelectField
          id="pricing_model"
          label="Pricing"
          options={PRICING_MODELS}
          value={v.pricing_model}
          onChange={set("pricing_model")}
        />
        <div className="grid grid-cols-[1fr_auto] items-end gap-4">
          <TextField
            id="quoted"
            label="Quoted"
            inputMode="decimal"
            placeholder="350,000"
            value={v.quoted}
            onChange={set("quoted")}
          />
          <SelectField
            id="currency"
            label="&nbsp;"
            aria-label="Currency"
            options={CURRENCY_OPTIONS}
            value={v.currency}
            onChange={set("currency")}
            className="w-20"
          />
        </div>
        {!project && (
          <TextField
            id="collected"
            label="Collected so far"
            inputMode="decimal"
            placeholder="Backfill — leave empty for new work"
            value={v.collected}
            onChange={set("collected")}
            className="sm:col-span-2"
          />
        )}
      </section>

      <section className="mt-10 grid grid-cols-1 gap-x-10 gap-y-7 border-t border-line pt-8 sm:grid-cols-2">
        <TextField id="start_date" label="Started" type="date" value={v.start_date} onChange={set("start_date")} />
        <TextField id="due_date" label="Due" type="date" value={v.due_date} onChange={set("due_date")} />
        <TextAreaField
          id="notes"
          label="Notes"
          rows={3}
          value={v.notes}
          onChange={set("notes")}
          className="sm:col-span-2"
        />
      </section>

      <div className="mt-10 flex items-center gap-5">
        <SubmitButton busy={busy}>
          {busy ? "Saving" : project ? "Save changes" : "Add project"}
        </SubmitButton>
        <FormError error={error} />
      </div>
    </form>
  );
}
