"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CURRENCIES, parseToMinor } from "@/lib/money";
import { EXPENSE_CATEGORIES } from "@/lib/domain";
import {
  TextField,
  SelectField,
  TextAreaField,
  SubmitButton,
  FormError,
  FieldLabel,
} from "@/components/fields";

/**
 * The 30-second capture: what, how much, snap the receipt, done. Screenshots
 * compress to WebP in the browser before upload (text on receipts stays
 * sharp where JPEG smears it); PDFs pass through untouched.
 */

export type ExpenseProjectOption = { id: string; name: string };

const CURRENCY_OPTIONS = CURRENCIES.map((c) => ({ value: c, label: c }));

function lagosToday(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Lagos" }).format(new Date());
}

function prettySize(bytes: number): string {
  return bytes >= 1024 * 1024
    ? `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export default function ExpenseForm({
  projects,
  presetProject,
}: {
  projects: ExpenseProjectOption[];
  presetProject?: string;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("NGN");
  const [spentAt, setSpentAt] = useState(lagosToday());
  const [category, setCategory] = useState("other");
  const [projectId, setProjectId] = useState(presetProject ?? "");
  const [billable, setBillable] = useState(false);
  const [receipt, setReceipt] = useState<File | null>(null);
  const [compressing, setCompressing] = useState(false);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const projectOptions = [
    { value: "", label: "General studio cost" },
    ...projects.map((p) => ({ value: p.id, label: p.name })),
  ];

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);

    if (file.type === "application/pdf") {
      setReceipt(file);
      return;
    }
    if (!file.type.startsWith("image/")) {
      setError("Receipts are images or PDFs.");
      return;
    }

    setCompressing(true);
    try {
      const { default: compress } = await import("browser-image-compression");
      const webp = await compress(file, {
        maxSizeMB: 0.4,
        maxWidthOrHeight: 1600,
        fileType: "image/webp",
        initialQuality: 0.85,
      });
      setReceipt(new File([webp], "receipt.webp", { type: "image/webp" }));
    } catch {
      // Compression is a nicety; the original still fits under the cap.
      setReceipt(file);
    }
    setCompressing(false);
  }

  function clearReceipt() {
    setReceipt(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy || compressing) return;

    const minor = parseToMinor(amount);
    if (minor === null || minor <= 0) {
      setError("The amount doesn't read as money.");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      let receiptDocId: string | null = null;
      if (receipt) {
        const form = new FormData();
        form.set("file", receipt);
        form.set("title", title || "Receipt");
        if (projectId) form.set("project_id", projectId);
        const up = await fetch("/api/receipts", { method: "POST", body: form });
        const upData = await up.json().catch(() => null);
        if (!up.ok) {
          setError(upData?.error ?? "The receipt didn't upload. Try again.");
          setBusy(false);
          return;
        }
        receiptDocId = upData.document_id;
      }

      const res = await fetch("/api/expenses", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          project_id: projectId || null,
          title,
          category,
          amount_minor: minor,
          currency,
          spent_at: spentAt,
          billable: projectId ? billable : false,
          receipt_document_id: receiptDocId,
          notes: notes || null,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error ?? "That didn't save. Try again.");
        setBusy(false);
        return;
      }
      router.push(projectId ? `/projects/${projectId}` : "/money");
      router.refresh();
    } catch {
      setError("Network hiccup. Try again.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="max-w-2xl">
      <section className="grid grid-cols-1 gap-x-10 gap-y-7 sm:grid-cols-2">
        <TextField
          id="exp-title"
          label="What for"
          placeholder="Framer annual, showroom fonts"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          autoFocus
        />
        <div className="grid grid-cols-[1fr_auto] items-end gap-4">
          <TextField
            id="exp-amount"
            label="Amount"
            inputMode="decimal"
            placeholder="25,000"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
          />
          <SelectField
            id="exp-currency"
            label="&nbsp;"
            aria-label="Currency"
            options={CURRENCY_OPTIONS}
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            className="w-20"
          />
        </div>
        <SelectField
          id="exp-category"
          label="Category"
          options={EXPENSE_CATEGORIES}
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        />
        <TextField
          id="exp-date"
          label="Spent"
          type="date"
          value={spentAt}
          onChange={(e) => setSpentAt(e.target.value)}
          required
        />
        <SelectField
          id="exp-project"
          label="Project"
          options={projectOptions}
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
        />
        <div className="flex items-end pb-1.5">
          <button
            type="button"
            role="checkbox"
            aria-checked={billable && !!projectId}
            disabled={!projectId}
            onClick={() => setBillable((b) => !b)}
            className="group flex items-center gap-3 disabled:opacity-40"
          >
            <span
              className={`inline-block h-4 w-4 rounded-full border transition-colors ${
                billable && projectId ? "border-fg bg-fg" : "border-line group-hover:border-fg"
              }`}
            />
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
              Billable to the client
            </span>
          </button>
        </div>
      </section>

      <section className="mt-10 border-t border-line pt-8">
        <FieldLabel htmlFor="exp-receipt">Receipt</FieldLabel>
        <input
          ref={fileRef}
          id="exp-receipt"
          type="file"
          accept="image/*,application/pdf"
          onChange={onFile}
          className="sr-only"
        />
        <div className="mt-3 flex flex-wrap items-center gap-4">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="inline-flex items-center rounded-full border border-line px-5 py-2.5 font-mono text-fluid-xs uppercase tracking-[0.18em] text-fg transition-colors duration-300 hover:border-fg"
          >
            {receipt ? "Replace" : "Attach"}
          </button>
          {compressing ? (
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
              Compressing
            </p>
          ) : receipt ? (
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
              {receipt.type === "application/pdf"
                ? "PDF"
                : receipt.type === "image/webp"
                  ? "WebP"
                  : "Image"}{" "}
              · {prettySize(receipt.size)}
              <button
                type="button"
                onClick={clearReceipt}
                className="ml-4 uppercase transition-colors hover:text-fg"
              >
                Remove
              </button>
            </p>
          ) : (
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
              Screenshot or PDF · compressed before upload
            </p>
          )}
        </div>
        <TextAreaField
          id="exp-notes"
          label="Notes"
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="mt-7"
        />
      </section>

      <div className="mt-10 flex items-center gap-5">
        <SubmitButton busy={busy || compressing}>{busy ? "Saving" : "Record it"}</SubmitButton>
        <FormError error={error} />
      </div>
    </form>
  );
}
