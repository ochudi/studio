"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { clsx } from "clsx";
import { HANDOVER_KINDS, labelFor, type HandoverItem } from "@/lib/domain";
import Chip from "@/components/Chip";
import { TextField, SelectField, SubmitButton, FormError } from "@/components/fields";

/**
 * The handover vault: what leaves your hands at closeout — logins, domains,
 * hosting, files — each with a dated transferred state, so the record shows
 * nothing is still hostage on your side.
 */

const transferFmt = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "Africa/Lagos",
});

function ItemRow({ item }: { item: HandoverItem }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const done = !!item.transferred_at;

  async function call(method: "PATCH" | "DELETE", body?: object) {
    if (busy) return;
    setBusy(true);
    await fetch(`/api/handover/${item.id}`, {
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
    <li className="group/ho flex items-baseline gap-4 py-3.5">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1.5">
          <p className={clsx("text-fluid-sm", done && "text-muted")}>{item.label}</p>
          <Chip>{labelFor(HANDOVER_KINDS, item.kind)}</Chip>
          {done && (
            <Chip filled>
              Transferred · {transferFmt.format(new Date(item.transferred_at as string))}
            </Chip>
          )}
        </div>
        {item.detail && (
          <p className="mt-1 max-w-[56ch] break-words text-fluid-xs leading-relaxed text-muted">
            {item.detail}
          </p>
        )}
      </div>
      <span className="flex shrink-0 items-center gap-4">
        <button
          type="button"
          disabled={busy}
          onClick={() => call("PATCH", { transferred: !done })}
          className={linkClass}
        >
          {done ? "Undo" : "Mark transferred"}
        </button>
        <span className="transition-opacity focus-within:opacity-100 group-hover/ho:opacity-100 sm:opacity-0">
          {confirming ? (
            <span className="flex items-center gap-4">
              <button type="button" disabled={busy} onClick={() => call("DELETE")} className={linkClass}>
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
        </span>
      </span>
    </li>
  );
}

export default function HandoverSection({
  projectId,
  items,
}: {
  projectId: string;
  items: HandoverItem[];
}) {
  const router = useRouter();
  const [label, setLabel] = useState("");
  const [kind, setKind] = useState("login");
  const [detail, setDetail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/handover", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          project_id: projectId,
          label,
          kind,
          detail: detail || null,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error ?? "That didn't save. Try again.");
        setBusy(false);
        return;
      }
      setLabel("");
      setDetail("");
      setBusy(false);
      router.refresh();
    } catch {
      setError("Network hiccup. Try again.");
      setBusy(false);
    }
  }

  return (
    <div>
      {items.length > 0 && (
        <ul className="divide-y divide-line border-y border-line">
          {items.map((item) => (
            <ItemRow key={item.id} item={item} />
          ))}
        </ul>
      )}
      <form
        onSubmit={onSubmit}
        className={clsx("flex flex-wrap items-end gap-x-6 gap-y-4", items.length > 0 && "mt-5")}
      >
        <TextField
          id="ho-label"
          label="Add an item"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="cPanel login"
          required
          className="min-w-0 flex-1 basis-48"
        />
        <SelectField
          id="ho-kind"
          label="Kind"
          options={HANDOVER_KINDS}
          value={kind}
          onChange={(e) => setKind(e.target.value)}
          className="w-36"
        />
        <TextField
          id="ho-detail"
          label="Detail (optional)"
          value={detail}
          onChange={(e) => setDetail(e.target.value)}
          placeholder="Where it lives, who holds it"
          className="min-w-0 flex-1 basis-56"
        />
        <SubmitButton busy={busy} className="px-5 py-2.5">
          {busy ? "Saving" : "Add"}
        </SubmitButton>
        <FormError error={error} />
      </form>
    </div>
  );
}
