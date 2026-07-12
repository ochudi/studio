"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CURRENCIES, parseToMinor } from "@/lib/money";
import { BLOCK_TYPES, emptyBlock, type DocBlock, type DocContent } from "@/lib/doc-blocks";
import { SubmitButton, FormError, FieldLabel } from "@/components/fields";

/**
 * The block editor, shared by documents and their masters. Lists and
 * questionnaires edit as one item per line — the fastest way to shuffle
 * twenty questions is a text box, not twenty text boxes.
 */

type PricingRowDraft = { label: string; detail: string; amount: string };
type BlockDraft =
  | { type: "heading" | "text"; text: string }
  | { type: "list" | "questions"; text: string }
  | { type: "pricing"; currency: string; rows: PricingRowDraft[] }
  | { type: "signatures"; parties: { label: string; name: string }[] };

function toDraft(block: DocBlock): BlockDraft {
  switch (block.type) {
    case "heading":
    case "text":
      return { type: block.type, text: block.text };
    case "list":
    case "questions":
      return { type: block.type, text: block.items.join("\n") };
    case "pricing":
      return {
        type: "pricing",
        currency: block.currency,
        rows: block.rows.map((r) => ({
          label: r.label,
          detail: r.detail,
          amount:
            r.amount_minor == null
              ? ""
              : (r.amount_minor / 100).toLocaleString("en", { maximumFractionDigits: 2 }),
        })),
      };
    case "signatures":
      return { type: "signatures", parties: block.parties.map((p) => ({ ...p })) };
  }
}

function fromDraft(draft: BlockDraft, index: number): { block?: DocBlock; error?: string } {
  switch (draft.type) {
    case "heading":
    case "text":
      return { block: { type: draft.type, text: draft.text.trim() } };
    case "list":
    case "questions":
      return {
        block: {
          type: draft.type,
          items: draft.text.split("\n").map((l) => l.trim()).filter(Boolean),
        },
      };
    case "pricing": {
      const rows = [];
      for (const r of draft.rows) {
        if (!r.label.trim() && !r.amount.trim()) continue;
        let minor: number | null = null;
        if (r.amount.trim()) {
          minor = parseToMinor(r.amount);
          if (minor === null) {
            return { error: `Block ${index + 1}: "${r.label || r.amount}" doesn't read as money.` };
          }
        }
        rows.push({ label: r.label.trim(), detail: r.detail.trim(), amount_minor: minor });
      }
      return { block: { type: "pricing", currency: draft.currency, rows } };
    }
    case "signatures":
      return {
        block: {
          type: "signatures",
          parties: draft.parties.filter((p) => p.label.trim() || p.name.trim()),
        },
      };
  }
}

const inputClass =
  "w-full border-b border-line bg-transparent pb-2 text-fluid-sm outline-none transition-colors focus:border-fg placeholder:text-muted/60";
const areaClass =
  "w-full resize-y border-b border-line bg-transparent pb-2 text-fluid-sm leading-relaxed outline-none transition-colors focus:border-fg placeholder:text-muted/60";
const linkClass =
  "font-mono text-[10px] uppercase tracking-[0.16em] text-muted transition-colors hover:text-fg disabled:opacity-30";

const PLACEHOLDER: Record<string, string> = {
  heading: "Section heading",
  text: "Body copy. A blank line starts a new paragraph.",
  list: "One item per line",
  questions: "One question per line",
};

export default function DocEditor({
  endpoint,
  initialTitle,
  titleLabel,
  content,
  backHref,
}: {
  endpoint: string;
  initialTitle: string;
  /** "title" for documents, "name" for templates: the PATCH field name. */
  titleLabel: "title" | "name";
  content: DocContent;
  backHref: string;
}) {
  const router = useRouter();
  const [title, setTitle] = useState(initialTitle);
  const [blocks, setBlocks] = useState<BlockDraft[]>(() => content.blocks.map(toDraft));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const update = (i: number, next: BlockDraft) =>
    setBlocks((prev) => prev.map((b, j) => (j === i ? next : b)));
  const move = (i: number, dir: -1 | 1) =>
    setBlocks((prev) => {
      const next = [...prev];
      const j = i + dir;
      if (j < 0 || j >= next.length) return prev;
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });

  async function onSave() {
    if (busy) return;
    const out: DocBlock[] = [];
    for (const [i, draft] of Array.from(blocks.entries())) {
      const { block, error: blockError } = fromDraft(draft, i);
      if (blockError) {
        setError(blockError);
        return;
      }
      if (block) out.push(block);
    }
    if (out.length === 0) {
      setError("A document needs at least one block.");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const res = await fetch(endpoint, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ [titleLabel]: title, content: { blocks: out } }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error ?? "That didn't save. Try again.");
        setBusy(false);
        return;
      }
      router.push(backHref);
      router.refresh();
    } catch {
      setError("Network hiccup. Try again.");
      setBusy(false);
    }
  }

  return (
    <form
      className="max-w-3xl"
      onSubmit={(e) => {
        e.preventDefault();
        onSave();
      }}
    >
      <input
        aria-label={titleLabel === "name" ? "Template name" : "Document title"}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="w-full border-b border-line bg-transparent pb-3 font-display text-fluid-xl tracking-tightest outline-none transition-colors focus:border-fg"
      />

      <ul className="mt-8 space-y-8">
        {blocks.map((b, i) => (
          <li key={i} className="group">
            <div className="flex items-baseline justify-between gap-4">
              <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted">
                {BLOCK_TYPES.find((t) => t.value === b.type)?.label}
              </p>
              <div className="flex items-baseline gap-3 sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
                <button type="button" aria-label="Move up" disabled={i === 0} onClick={() => move(i, -1)} className={linkClass}>
                  Up
                </button>
                <button
                  type="button"
                  aria-label="Move down"
                  disabled={i === blocks.length - 1}
                  onClick={() => move(i, 1)}
                  className={linkClass}
                >
                  Down
                </button>
                <button
                  type="button"
                  onClick={() => setBlocks((prev) => prev.filter((_, j) => j !== i))}
                  className={linkClass}
                >
                  Remove
                </button>
              </div>
            </div>

            <div className="mt-2.5">
              {(b.type === "heading" || b.type === "text" || b.type === "list" || b.type === "questions") &&
                (b.type === "heading" ? (
                  <input
                    aria-label={`Block ${i + 1} heading`}
                    value={b.text}
                    onChange={(e) => update(i, { ...b, text: e.target.value })}
                    placeholder={PLACEHOLDER.heading}
                    className={`${inputClass} font-display text-fluid-lg tracking-tightest`}
                  />
                ) : (
                  <textarea
                    aria-label={`Block ${i + 1} ${b.type}`}
                    value={b.text}
                    onChange={(e) => update(i, { ...b, text: e.target.value })}
                    placeholder={PLACEHOLDER[b.type]}
                    rows={b.type === "text" ? 4 : 4}
                    className={areaClass}
                  />
                ))}

              {b.type === "pricing" && (
                <div>
                  <div className="flex justify-end">
                    <select
                      aria-label="Pricing currency"
                      value={b.currency}
                      onChange={(e) => update(i, { ...b, currency: e.target.value })}
                      className="w-20 cursor-pointer appearance-none rounded-none border-b border-line bg-transparent pb-1 font-mono text-fluid-xs uppercase tracking-[0.16em] outline-none transition-colors focus:border-fg"
                    >
                      {CURRENCIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                  <ul className="mt-3 space-y-5">
                    {b.rows.map((row, ri) => (
                      <li key={ri} className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_7rem_auto] sm:items-end">
                        <input
                          aria-label={`Row ${ri + 1} phase`}
                          value={row.label}
                          onChange={(e) =>
                            update(i, { ...b, rows: b.rows.map((r, rj) => (rj === ri ? { ...r, label: e.target.value } : r)) })
                          }
                          placeholder="Phase"
                          className={inputClass}
                        />
                        <input
                          aria-label={`Row ${ri + 1} detail`}
                          value={row.detail}
                          onChange={(e) =>
                            update(i, { ...b, rows: b.rows.map((r, rj) => (rj === ri ? { ...r, detail: e.target.value } : r)) })
                          }
                          placeholder="Detail, optional"
                          className={inputClass}
                        />
                        <input
                          aria-label={`Row ${ri + 1} amount`}
                          inputMode="decimal"
                          value={row.amount}
                          onChange={(e) =>
                            update(i, { ...b, rows: b.rows.map((r, rj) => (rj === ri ? { ...r, amount: e.target.value } : r)) })
                          }
                          placeholder="On scoping"
                          className={inputClass}
                        />
                        <button
                          type="button"
                          aria-label={`Remove row ${ri + 1}`}
                          disabled={b.rows.length === 1}
                          onClick={() => update(i, { ...b, rows: b.rows.filter((_, rj) => rj !== ri) })}
                          className={`${linkClass} pb-2`}
                        >
                          Remove
                        </button>
                      </li>
                    ))}
                  </ul>
                  <button
                    type="button"
                    onClick={() => update(i, { ...b, rows: [...b.rows, { label: "", detail: "", amount: "" }] })}
                    className={`${linkClass} mt-4`}
                  >
                    + Add row
                  </button>
                </div>
              )}

              {b.type === "signatures" && (
                <ul className="space-y-4">
                  {b.parties.map((party, pi) => (
                    <li key={pi} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <input
                        aria-label={`Party ${pi + 1} label`}
                        value={party.label}
                        onChange={(e) =>
                          update(i, { ...b, parties: b.parties.map((p, pj) => (pj === pi ? { ...p, label: e.target.value } : p)) })
                        }
                        placeholder="For the client"
                        className={inputClass}
                      />
                      <input
                        aria-label={`Party ${pi + 1} name`}
                        value={party.name}
                        onChange={(e) =>
                          update(i, { ...b, parties: b.parties.map((p, pj) => (pj === pi ? { ...p, name: e.target.value } : p)) })
                        }
                        placeholder="Name, optional until signing"
                        className={inputClass}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </li>
        ))}
      </ul>

      <div className="mt-8 border-t border-line pt-6">
        <FieldLabel htmlFor="add-heading">Add a block</FieldLabel>
        <div className="mt-3 flex flex-wrap gap-2">
          {BLOCK_TYPES.map((t) => (
            <button
              key={t.value}
              id={`add-${t.value}`}
              type="button"
              onClick={() => setBlocks((prev) => [...prev, toDraft(emptyBlock(t.value))])}
              className="inline-flex items-center rounded-full border border-line px-4 py-2 font-mono text-[10px] uppercase tracking-[0.16em] text-muted transition-colors hover:border-fg hover:text-fg"
            >
              + {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-10 flex items-center gap-5">
        <SubmitButton busy={busy}>{busy ? "Saving" : "Save"}</SubmitButton>
        <button
          type="button"
          onClick={() => router.push(backHref)}
          className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted transition-colors hover:text-fg"
        >
          Cancel
        </button>
        <FormError error={error} />
      </div>
    </form>
  );
}
