"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CURRENCIES, parseToMinor, formatMinor } from "@/lib/money";
import { invoiceTotals, courtesyLabel } from "@/lib/invoice";
import type { Invoice, InvoiceItem } from "@/lib/domain";
import {
  TextField,
  SelectField,
  TextAreaField,
  SubmitButton,
  FormError,
  FieldLabel,
} from "@/components/fields";

/**
 * The invoice builder. Lines carry full value; one named courtesy line
 * brings the total down — the true-worth pattern, previewed live so the
 * invoice reads exactly as the client will see it before it exists.
 */

export type ClientOption = {
  value: string;
  label: string;
  currency: string;
  relationship: string;
  default_discount_pct: number;
};
export type ProjectOption = { id: string; client_id: string; name: string };

type Line = { title: string; description: string; qty: string; unit: string };
const EMPTY_LINE: Line = { title: "", description: "", qty: "1", unit: "" };

const CURRENCY_OPTIONS = CURRENCIES.map((c) => ({ value: c, label: c }));

function lagosToday(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Lagos" }).format(new Date());
}

function toUnitString(minor: number): string {
  return (minor / 100).toLocaleString("en", { maximumFractionDigits: 2 });
}

export default function InvoiceForm({
  invoice,
  items,
  clients,
  projects,
  presetClient,
  presetProject,
  defaultTerms,
  defaultTaxPct,
}: {
  invoice?: Invoice;
  items?: InvoiceItem[];
  clients: ClientOption[];
  projects: ProjectOption[];
  presetClient?: string;
  presetProject?: string;
  defaultTerms: string | null;
  defaultTaxPct: number;
}) {
  const router = useRouter();
  const preset = clients.find((c) => c.value === (invoice?.client_id ?? presetClient));

  const [clientId, setClientId] = useState(invoice?.client_id ?? presetClient ?? "");
  const [projectId, setProjectId] = useState(invoice?.project_id ?? presetProject ?? "");
  const [currency, setCurrency] = useState(invoice?.currency ?? preset?.currency ?? "NGN");
  const [issueDate, setIssueDate] = useState(invoice?.issue_date ?? lagosToday());
  const [dueDate, setDueDate] = useState(invoice?.due_date ?? "");
  const [discountPct, setDiscountPct] = useState(
    invoice
      ? String(invoice.discount_pct ?? 0)
      : preset && preset.default_discount_pct > 0
        ? String(preset.default_discount_pct)
        : "0"
  );
  const [discountLabel, setDiscountLabel] = useState(
    invoice?.discount_label ?? (preset ? courtesyLabel(preset.relationship) ?? "" : "")
  );
  const [taxPct, setTaxPct] = useState(String(invoice?.tax_pct ?? defaultTaxPct ?? 0));
  const [notes, setNotes] = useState(invoice?.notes ?? "");
  const [terms, setTerms] = useState(invoice?.terms ?? defaultTerms ?? "");
  const [lines, setLines] = useState<Line[]>(() =>
    items && items.length > 0
      ? items.map((it) => ({
          title: it.title,
          description: it.description ?? "",
          qty: String(it.quantity),
          unit: toUnitString(it.unit_minor),
        }))
      : [{ ...EMPTY_LINE }]
  );
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const clientOptions = clientId
    ? clients
    : [{ value: "", label: "Pick a client", currency: "NGN", relationship: "standard", default_discount_pct: 0 }, ...clients];
  const projectOptions = [
    { value: "", label: "No project" },
    ...projects.filter((p) => p.client_id === clientId).map((p) => ({ value: p.id, label: p.name })),
  ];

  function onClientChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const id = e.target.value;
    setClientId(id);
    setProjectId("");
    const c = clients.find((opt) => opt.value === id);
    // A new client resets billing defaults only on create — an existing
    // draft keeps whatever was already decided.
    if (c && !invoice) {
      setCurrency(c.currency);
      setDiscountPct(c.default_discount_pct > 0 ? String(c.default_discount_pct) : "0");
      setDiscountLabel(courtesyLabel(c.relationship) ?? "");
    }
  }

  const setLine = (i: number, key: keyof Line) => (
    e: React.ChangeEvent<HTMLInputElement>
  ) => setLines((prev) => prev.map((l, j) => (j === i ? { ...l, [key]: e.target.value } : l)));

  const preview = useMemo(() => {
    const parsed = lines.map((l) => ({
      quantity: parseFloat(l.qty.replace(/,/g, "")) || 0,
      unit_minor: parseToMinor(l.unit) ?? 0,
    }));
    return invoiceTotals(parsed, parseFloat(discountPct) || 0, parseFloat(taxPct) || 0);
  }, [lines, discountPct, taxPct]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;

    const parsedLines = [];
    for (const [i, l] of Array.from(lines.entries())) {
      const unit = parseToMinor(l.unit);
      if (unit === null) {
        setError(`Line ${i + 1}: the unit price doesn't read as money.`);
        return;
      }
      const quantity = parseFloat(l.qty.replace(/,/g, ""));
      if (!Number.isFinite(quantity) || quantity <= 0) {
        setError(`Line ${i + 1}: quantity has to be above zero.`);
        return;
      }
      parsedLines.push({
        title: l.title,
        description: l.description || null,
        quantity,
        unit_minor: unit,
        sort_order: i,
      });
    }

    setBusy(true);
    setError(null);

    const payload = {
      client_id: clientId,
      project_id: projectId || null,
      currency,
      issue_date: issueDate,
      due_date: dueDate || null,
      discount_pct: parseFloat(discountPct) || 0,
      discount_label: discountLabel || null,
      tax_pct: parseFloat(taxPct) || 0,
      notes: notes || null,
      terms: terms || null,
      items: parsedLines,
    };

    try {
      const res = await fetch(invoice ? `/api/invoices/${invoice.id}` : "/api/invoices", {
        method: invoice ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error ?? "That didn't save. Try again.");
        setBusy(false);
        return;
      }
      router.push(`/money/invoices/${invoice ? invoice.id : data.id}`);
      router.refresh();
    } catch {
      setError("Network hiccup. Try again.");
      setBusy(false);
    }
  }

  const discount = parseFloat(discountPct) || 0;
  const tax = parseFloat(taxPct) || 0;

  return (
    <form onSubmit={onSubmit} className="max-w-2xl">
      <section className="grid grid-cols-1 gap-x-10 gap-y-7 sm:grid-cols-2">
        <SelectField
          id="inv-client"
          label="Client"
          options={clientOptions}
          value={clientId}
          onChange={onClientChange}
          required
          disabled={!!invoice}
        />
        <SelectField
          id="inv-project"
          label="Project"
          options={projectOptions}
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
        />
        <TextField
          id="inv-issued"
          label="Issued"
          type="date"
          value={issueDate}
          onChange={(e) => setIssueDate(e.target.value)}
          required
        />
        <TextField
          id="inv-due"
          label="Due"
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
        />
      </section>

      <section className="mt-10 border-t border-line pt-8">
        <div className="flex items-end justify-between gap-6">
          <FieldLabel htmlFor="line-title-0">Lines · full value</FieldLabel>
          <select
            id="inv-currency"
            aria-label="Currency"
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            className="w-20 cursor-pointer appearance-none rounded-none border-b border-line bg-transparent pb-1 font-mono text-fluid-xs uppercase tracking-[0.16em] outline-none transition-colors focus:border-fg"
          >
            {CURRENCY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        <ul className="mt-4 space-y-6">
          {lines.map((l, i) => (
            <li key={i} className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-3 sm:grid-cols-[1fr_5rem_8rem_auto] sm:items-end">
              <div className="col-span-2 sm:col-span-1">
                <input
                  id={`line-title-${i}`}
                  aria-label={`Line ${i + 1} title`}
                  placeholder="Design & build, greyform.org"
                  value={l.title}
                  onChange={setLine(i, "title")}
                  required
                  className="w-full border-b border-line bg-transparent pb-2 text-fluid-base outline-none transition-colors focus:border-fg placeholder:text-muted/60"
                />
                <input
                  aria-label={`Line ${i + 1} detail`}
                  placeholder="Detail, optional"
                  value={l.description}
                  onChange={setLine(i, "description")}
                  className="mt-2 w-full border-b border-transparent bg-transparent pb-1 text-fluid-xs text-muted outline-none transition-colors focus:border-line placeholder:text-muted/50"
                />
              </div>
              <div>
                <FieldLabel htmlFor={`line-qty-${i}`}>Qty</FieldLabel>
                <input
                  id={`line-qty-${i}`}
                  inputMode="decimal"
                  value={l.qty}
                  onChange={setLine(i, "qty")}
                  className="mt-2 w-full border-b border-line bg-transparent pb-2 text-fluid-base outline-none transition-colors focus:border-fg"
                />
              </div>
              <div>
                <FieldLabel htmlFor={`line-unit-${i}`}>Unit price</FieldLabel>
                <input
                  id={`line-unit-${i}`}
                  inputMode="decimal"
                  placeholder="350,000"
                  value={l.unit}
                  onChange={setLine(i, "unit")}
                  className="mt-2 w-full border-b border-line bg-transparent pb-2 text-fluid-base outline-none transition-colors focus:border-fg placeholder:text-muted/60"
                />
              </div>
              <button
                type="button"
                aria-label={`Remove line ${i + 1}`}
                disabled={lines.length === 1}
                onClick={() => setLines((prev) => prev.filter((_, j) => j !== i))}
                className="pb-2 font-mono text-[10px] uppercase tracking-[0.16em] text-muted transition-colors hover:text-fg disabled:opacity-30"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>

        <button
          type="button"
          onClick={() => setLines((prev) => [...prev, { ...EMPTY_LINE }])}
          className="mt-5 font-mono text-[10px] uppercase tracking-[0.18em] text-muted transition-colors hover:text-fg"
        >
          + Add line
        </button>
      </section>

      <section className="mt-10 grid grid-cols-1 gap-x-10 gap-y-7 border-t border-line pt-8 sm:grid-cols-2">
        <div className="grid grid-cols-[5rem_1fr] items-end gap-4">
          <TextField
            id="inv-discount"
            label="Less %"
            inputMode="decimal"
            value={discountPct}
            onChange={(e) => setDiscountPct(e.target.value)}
          />
          <TextField
            id="inv-discount-label"
            label="Named as"
            placeholder="Friends & family courtesy"
            value={discountLabel}
            onChange={(e) => setDiscountLabel(e.target.value)}
          />
        </div>
        <TextField
          id="inv-tax"
          label="Tax %"
          inputMode="decimal"
          value={taxPct}
          onChange={(e) => setTaxPct(e.target.value)}
          className="sm:w-24"
        />
        <TextAreaField
          id="inv-notes"
          label="Notes on the invoice"
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="sm:col-span-2"
        />
        <TextAreaField
          id="inv-terms"
          label="Terms"
          rows={2}
          value={terms}
          onChange={(e) => setTerms(e.target.value)}
          className="sm:col-span-2"
        />
      </section>

      {/* Live preview of what the client will read, true-worth line included. */}
      <section aria-label="Totals preview" className="mt-10 border-t border-line pt-6">
        <dl className="ml-auto max-w-xs space-y-2">
          {(preview.discountMinor > 0 || preview.taxMinor > 0) && (
            <div className="flex items-baseline justify-between gap-6">
              <dt className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted">Subtotal</dt>
              <dd className="tnum text-fluid-sm">{formatMinor(preview.gross, currency)}</dd>
            </div>
          )}
          {preview.discountMinor > 0 && (
            <div className="flex items-baseline justify-between gap-6">
              <dt className="min-w-0 truncate font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
                {discountLabel || "Courtesy"}, less {discount}%
              </dt>
              <dd className="tnum whitespace-nowrap text-fluid-sm">−{formatMinor(preview.discountMinor, currency)}</dd>
            </div>
          )}
          {preview.taxMinor > 0 && (
            <div className="flex items-baseline justify-between gap-6">
              <dt className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted">Tax · {tax}%</dt>
              <dd className="tnum text-fluid-sm">{formatMinor(preview.taxMinor, currency)}</dd>
            </div>
          )}
          <div className="flex items-baseline justify-between gap-6 border-t border-fg pt-3">
            <dt className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted">Total due</dt>
            <dd className="tnum font-display text-fluid-xl tracking-tightest">
              {formatMinor(preview.total, currency)}
            </dd>
          </div>
        </dl>
      </section>

      <div className="mt-10 flex items-center gap-5">
        <SubmitButton busy={busy}>
          {busy ? "Saving" : invoice ? "Save draft" : "Create draft"}
        </SubmitButton>
        <FormError error={error} />
      </div>
    </form>
  );
}
