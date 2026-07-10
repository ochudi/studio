import { z } from "zod";
import { CURRENCIES } from "@/lib/money";

/**
 * Shared vocabulary for clients and correspondence: option lists rendered
 * into selects, zod schemas enforced at the API boundary. Values mirror the
 * check constraints in 0001_studio_core.sql — the database is the final
 * word, this file keeps typos from ever reaching it.
 */

export const CLIENT_SOURCES = [
  { value: "inquiry", label: "Site inquiry" },
  { value: "phone_call", label: "Phone call" },
  { value: "referral", label: "Referral" },
  { value: "repeat", label: "Repeat client" },
  { value: "other", label: "Other" },
] as const;

export const RELATIONSHIPS = [
  { value: "standard", label: "Standard" },
  { value: "friends_family", label: "Friends & family" },
  { value: "pro_bono", label: "Pro bono" },
] as const;

export const CHANNELS = [
  { value: "whatsapp", label: "WhatsApp" },
  { value: "call", label: "Call" },
  { value: "email", label: "Email" },
  { value: "sms", label: "SMS" },
  { value: "meeting", label: "Meeting" },
  { value: "in_person", label: "In person" },
  { value: "other", label: "Other" },
] as const;

export function labelFor(
  options: readonly { value: string; label: string }[],
  value: string | null | undefined
): string {
  return options.find((o) => o.value === value)?.label ?? value ?? "";
}

const trimmed = z
  .string()
  .transform((s) => s.trim())
  .pipe(z.string());
const optional = trimmed.transform((s) => (s === "" ? null : s)).nullish();

export const clientSchema = z.object({
  name: trimmed.pipe(z.string().min(1, "A name is the one thing required.")),
  company: optional,
  email: optional.pipe(z.string().email("That email doesn't look right.").nullish()),
  phone: optional,
  whatsapp: optional,
  location: optional,
  source: z.enum(CLIENT_SOURCES.map((s) => s.value) as [string, ...string[]]),
  referred_by: optional,
  relationship: z.enum(RELATIONSHIPS.map((r) => r.value) as [string, ...string[]]),
  default_discount_pct: z.coerce.number().min(0).max(100).default(0),
  currency: z.enum(CURRENCIES),
  preferred_channel: optional,
  decision_maker: optional,
  update_cadence: optional,
  notes: optional,
});

export const correspondenceSchema = z.object({
  client_id: z.string().uuid(),
  project_id: z.string().uuid().nullish(),
  channel: z.enum(CHANNELS.map((c) => c.value) as [string, ...string[]]),
  direction: z.enum(["in", "out"]),
  occurred_at: z.string().datetime({ offset: true }),
  summary: trimmed.pipe(z.string().min(1, "Say what happened, even briefly.")),
  body: optional,
  is_decision: z.boolean().default(false),
  follow_up_on: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a real date.")
    .nullish(),
});

export type Client = {
  id: string;
  name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  location: string | null;
  source: string;
  referred_by: string | null;
  relationship: string;
  default_discount_pct: number;
  currency: string;
  preferred_channel: string | null;
  decision_maker: string | null;
  update_cadence: string | null;
  notes: string | null;
  created_at: string;
  archived_at: string | null;
};

export type Correspondence = {
  id: string;
  client_id: string;
  project_id: string | null;
  channel: string;
  direction: "in" | "out";
  occurred_at: string;
  summary: string;
  body: string | null;
  is_decision: boolean;
  follow_up_on: string | null;
};
