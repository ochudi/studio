"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CURRENCIES } from "@/lib/money";
import { CLIENT_SOURCES, RELATIONSHIPS, CHANNELS, type Client } from "@/lib/domain";
import {
  TextField,
  SelectField,
  TextAreaField,
  SubmitButton,
  FormError,
} from "@/components/fields";

/**
 * One form for create and edit. Conditional fields keep it honest:
 * referred-by only appears for referrals, the courtesy discount only for
 * friends-family / pro-bono relationships.
 */

type Values = {
  name: string;
  company: string;
  email: string;
  phone: string;
  whatsapp: string;
  location: string;
  source: string;
  referred_by: string;
  relationship: string;
  default_discount_pct: string;
  currency: string;
  preferred_channel: string;
  decision_maker: string;
  update_cadence: string;
  notes: string;
};

function fromClient(c?: Client): Values {
  return {
    name: c?.name ?? "",
    company: c?.company ?? "",
    email: c?.email ?? "",
    phone: c?.phone ?? "",
    whatsapp: c?.whatsapp ?? "",
    location: c?.location ?? "",
    source: c?.source ?? "other",
    referred_by: c?.referred_by ?? "",
    relationship: c?.relationship ?? "standard",
    default_discount_pct: c ? String(c.default_discount_pct) : "0",
    currency: c?.currency ?? "NGN",
    preferred_channel: c?.preferred_channel ?? "",
    decision_maker: c?.decision_maker ?? "",
    update_cadence: c?.update_cadence ?? "",
    notes: c?.notes ?? "",
  };
}

const CHANNEL_OPTIONS = [{ value: "", label: "No preference yet" }, ...CHANNELS];
const CURRENCY_OPTIONS = CURRENCIES.map((c) => ({ value: c, label: c }));

export default function ClientForm({ client }: { client?: Client }) {
  const router = useRouter();
  const [v, setV] = useState<Values>(() => fromClient(client));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const set = (key: keyof Values) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => setV((prev) => ({ ...prev, [key]: e.target.value }));

  const courtesy = v.relationship !== "standard";

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);

    const payload = {
      ...v,
      preferred_channel: v.preferred_channel || null,
      default_discount_pct: courtesy ? Number(v.default_discount_pct) || 0 : 0,
      referred_by: v.source === "referral" ? v.referred_by : null,
    };

    try {
      const res = await fetch(client ? `/api/clients/${client.id}` : "/api/clients", {
        method: client ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error ?? "That didn't save. Try again.");
        setBusy(false);
        return;
      }
      router.push(`/clients/${client ? client.id : data.id}`);
      router.refresh();
    } catch {
      setError("Network hiccup. Try again.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="max-w-2xl">
      <section className="grid grid-cols-1 gap-x-10 gap-y-7 sm:grid-cols-2">
        <TextField id="name" label="Name" value={v.name} onChange={set("name")} autoFocus required />
        <TextField id="company" label="Company" value={v.company} onChange={set("company")} />
        <TextField id="email" label="Email" type="email" value={v.email} onChange={set("email")} />
        <TextField id="phone" label="Phone" type="tel" value={v.phone} onChange={set("phone")} />
        <TextField id="whatsapp" label="WhatsApp" type="tel" value={v.whatsapp} onChange={set("whatsapp")} placeholder="If different from phone" />
        <TextField id="location" label="Location" value={v.location} onChange={set("location")} placeholder="Lagos · London · ..." />
      </section>

      <section className="mt-10 grid grid-cols-1 gap-x-10 gap-y-7 border-t border-line pt-8 sm:grid-cols-2">
        <SelectField id="source" label="How they arrived" options={CLIENT_SOURCES} value={v.source} onChange={set("source")} />
        {v.source === "referral" && (
          <TextField id="referred_by" label="Referred by" value={v.referred_by} onChange={set("referred_by")} />
        )}
        <SelectField id="relationship" label="Relationship" options={RELATIONSHIPS} value={v.relationship} onChange={set("relationship")} />
        {courtesy && (
          <TextField
            id="default_discount_pct"
            label="Courtesy discount %"
            type="number"
            min={0}
            max={100}
            value={v.default_discount_pct}
            onChange={set("default_discount_pct")}
          />
        )}
        <SelectField id="currency" label="Billing currency" options={CURRENCY_OPTIONS} value={v.currency} onChange={set("currency")} />
      </section>

      <section className="mt-10 grid grid-cols-1 gap-x-10 gap-y-7 border-t border-line pt-8 sm:grid-cols-2">
        <SelectField id="preferred_channel" label="Preferred channel" options={CHANNEL_OPTIONS} value={v.preferred_channel} onChange={set("preferred_channel")} />
        <TextField id="decision_maker" label="Who decides" value={v.decision_maker} onChange={set("decision_maker")} placeholder="If not the client themselves" />
        <TextField id="update_cadence" label="Update cadence" value={v.update_cadence} onChange={set("update_cadence")} placeholder="Weekly WhatsApp recap, ..." className="sm:col-span-2" />
        <TextAreaField id="notes" label="Notes" rows={4} value={v.notes} onChange={set("notes")} className="sm:col-span-2" />
      </section>

      <div className="mt-10 flex items-center gap-5">
        <SubmitButton busy={busy}>
          {busy ? "Saving" : client ? "Save changes" : "Add client"}
        </SubmitButton>
        <FormError error={error} />
      </div>
    </form>
  );
}
