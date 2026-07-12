"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CURRENCIES } from "@/lib/money";
import type { PaymentDetail } from "@/lib/domain";
import {
  TextField,
  TextAreaField,
  SubmitButton,
  FormError,
  FieldLabel,
} from "@/components/fields";

/**
 * What invoices render: default terms, default tax, and how to get paid in
 * each currency. A currency with no details simply prints no payment block.
 */

type DetailDraft = { label: string; lines: string };

export default function BillingSettingsForm({
  defaultTerms,
  defaultTaxPct,
  paymentDetails,
}: {
  defaultTerms: string | null;
  defaultTaxPct: number;
  paymentDetails: Record<string, PaymentDetail>;
}) {
  const router = useRouter();
  const [terms, setTerms] = useState(defaultTerms ?? "");
  const [tax, setTax] = useState(String(defaultTaxPct));
  const [details, setDetails] = useState<Record<string, DetailDraft>>(() =>
    Object.fromEntries(
      CURRENCIES.map((c) => [
        c,
        {
          label: paymentDetails[c]?.label ?? "",
          lines: (paymentDetails[c]?.lines ?? []).join("\n"),
        },
      ])
    )
  );
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  const setDetail = (currency: string, key: keyof DetailDraft) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setSaved(false);
    setDetails((prev) => ({
      ...prev,
      [currency]: { ...prev[currency], [key]: e.target.value },
    }));
  };

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;

    const payment_details: Record<string, PaymentDetail> = {};
    for (const c of CURRENCIES) {
      const d = details[c];
      const lines = d.lines
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);
      if (d.label.trim() && lines.length > 0) {
        payment_details[c] = { label: d.label.trim(), lines };
      } else if (d.label.trim() || lines.length > 0) {
        setError(`${c}: give the payment route both a name and its details.`);
        return;
      }
    }

    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          default_terms: terms || null,
          default_tax_pct: parseFloat(tax) || 0,
          payment_details,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error ?? "That didn't save. Try again.");
        setBusy(false);
        return;
      }
      setBusy(false);
      setSaved(true);
      router.refresh();
    } catch {
      setError("Network hiccup. Try again.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="max-w-2xl">
      <section className="grid grid-cols-1 gap-x-10 gap-y-7 sm:grid-cols-2">
        <TextAreaField
          id="set-terms"
          label="Default terms"
          rows={2}
          placeholder="Half up front, balance on delivery."
          value={terms}
          onChange={(e) => {
            setSaved(false);
            setTerms(e.target.value);
          }}
          className="sm:col-span-2"
        />
        <TextField
          id="set-tax"
          label="Default tax %"
          inputMode="decimal"
          value={tax}
          onChange={(e) => {
            setSaved(false);
            setTax(e.target.value);
          }}
          className="sm:w-40"
        />
      </section>

      <section className="mt-10 border-t border-line pt-8">
        <FieldLabel htmlFor="detail-NGN-label">Payment details · rendered onto invoices</FieldLabel>
        <ul className="mt-5 space-y-8">
          {CURRENCIES.map((c) => (
            <li key={c} className="grid grid-cols-[3.5rem_1fr] gap-x-6 gap-y-3 sm:grid-cols-[3.5rem_14rem_1fr]">
              <p className="pt-1 font-mono text-fluid-xs uppercase tracking-[0.16em] text-fg">{c}</p>
              <TextField
                id={`detail-${c}-label`}
                label="Route"
                placeholder={c === "NGN" ? "Bank transfer" : "Wise"}
                value={details[c].label}
                onChange={setDetail(c, "label")}
              />
              <TextAreaField
                id={`detail-${c}-lines`}
                label="Details, one per line"
                rows={2}
                placeholder={
                  c === "NGN"
                    ? "GTBank\n0123456789 · KeyPass Solutions"
                    : "Account name\nIBAN or account number"
                }
                value={details[c].lines}
                onChange={setDetail(c, "lines")}
                className="col-span-2 sm:col-span-1"
              />
            </li>
          ))}
        </ul>
      </section>

      <div className="mt-10 flex items-center gap-5">
        <SubmitButton busy={busy}>{busy ? "Saving" : "Save billing"}</SubmitButton>
        {saved && (
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted">Saved</p>
        )}
        <FormError error={error} />
      </div>
    </form>
  );
}
