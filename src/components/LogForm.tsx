"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CHANNELS } from "@/lib/domain";
import {
  TextField,
  SelectField,
  TextAreaField,
  SubmitButton,
  FormError,
  FieldLabel,
} from "@/components/fields";
import { clsx } from "clsx";

/**
 * The quick-capture surface: designed to be filled one-handed on a phone
 * right after a call. Occurred-at defaults to now; a follow-up date turns
 * the entry into a queued next move on Today.
 */

function nowLocal(): string {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

export default function LogForm({ clientId }: { clientId: string }) {
  const router = useRouter();
  const [channel, setChannel] = useState("whatsapp");
  const [direction, setDirection] = useState<"in" | "out">("in");
  const [occurredAt, setOccurredAt] = useState(nowLocal);
  const [summary, setSummary] = useState("");
  const [body, setBody] = useState("");
  const [isDecision, setIsDecision] = useState(false);
  const [followUpOn, setFollowUpOn] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/correspondence", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          client_id: clientId,
          channel,
          direction,
          occurred_at: new Date(occurredAt).toISOString(),
          summary,
          body: body || null,
          is_decision: isDecision,
          follow_up_on: followUpOn || null,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error ?? "That didn't save. Try again.");
        setBusy(false);
        return;
      }
      setSummary("");
      setBody("");
      setIsDecision(false);
      setFollowUpOn("");
      setOccurredAt(nowLocal());
      setBusy(false);
      router.refresh();
    } catch {
      setError("Network hiccup. Try again.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="rounded-lg border border-line bg-raised p-5 md:p-6">
      <div className="grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-4">
        <SelectField id="log-channel" label="Channel" options={CHANNELS} value={channel} onChange={(e) => setChannel(e.target.value)} />
        <div>
          <FieldLabel htmlFor="log-direction">Direction</FieldLabel>
          <div id="log-direction" role="group" className="mt-2 flex border-b border-line pb-2">
            {(["in", "out"] as const).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDirection(d)}
                aria-pressed={direction === d}
                className={clsx(
                  "rounded-full px-3 py-1 font-mono text-[10px] uppercase tracking-[0.16em] transition-colors",
                  direction === d ? "bg-fg text-bg" : "text-muted hover:text-fg"
                )}
              >
                {d === "in" ? "From them" : "From me"}
              </button>
            ))}
          </div>
        </div>
        <TextField id="log-occurred" label="When" type="datetime-local" value={occurredAt} onChange={(e) => setOccurredAt(e.target.value)} />
        <TextField id="log-follow-up" label="Follow up by" type="date" value={followUpOn} onChange={(e) => setFollowUpOn(e.target.value)} />
      </div>

      <TextField
        id="log-summary"
        label="What happened"
        value={summary}
        onChange={(e) => setSummary(e.target.value)}
        placeholder="Agreed homepage copy revisions by Friday"
        className="mt-5"
        required
      />
      <TextAreaField
        id="log-body"
        label="Details (optional)"
        rows={2}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        className="mt-5"
      />

      <div className="mt-6 flex flex-wrap items-center gap-5">
        <SubmitButton busy={busy}>{busy ? "Saving" : "Log it"}</SubmitButton>
        <label className="flex cursor-pointer select-none items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
          <input
            type="checkbox"
            checked={isDecision}
            onChange={(e) => setIsDecision(e.target.checked)}
            className="h-3.5 w-3.5 accent-current"
          />
          Decision — changed scope, price or timeline
        </label>
        <FormError error={error} />
      </div>
    </form>
  );
}
