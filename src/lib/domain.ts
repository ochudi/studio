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

export const PROJECT_KINDS = [
  { value: "design", label: "Design" },
  { value: "development", label: "Development" },
  { value: "design_development", label: "Design & development" },
  { value: "retainer", label: "Retainer" },
  { value: "maintenance", label: "Maintenance" },
  { value: "consulting", label: "Consulting" },
  { value: "other", label: "Other" },
] as const;

/** Pipeline order. Rendering iterates this, so the board reads left to right. */
export const PROJECT_STATUSES = [
  { value: "lead", label: "Lead" },
  { value: "proposal_sent", label: "Proposal sent" },
  { value: "agreed", label: "Agreed" },
  { value: "onboarding", label: "Onboarding" },
  { value: "active", label: "Active" },
  { value: "paused", label: "Paused" },
  { value: "in_review", label: "In review" },
  { value: "delivered", label: "Delivered" },
  { value: "closed", label: "Closed" },
  { value: "lost", label: "Lost" },
] as const;

/** Statuses that mean the project is still moving; closed/lost sit behind a toggle. */
export const LIVE_STATUSES = PROJECT_STATUSES.map((s) => s.value).filter(
  (s) => s !== "closed" && s !== "lost"
);

export const PRICING_MODELS = [
  { value: "fixed", label: "Fixed price" },
  { value: "hourly", label: "Hourly" },
  { value: "retainer", label: "Retainer" },
] as const;

export const CR_STATUSES = [
  { value: "draft", label: "Draft" },
  { value: "sent", label: "Sent" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
] as const;

/**
 * Stored invoice statuses. `overdue` exists in the database check constraint
 * but is never stored — it's derived at render time from due_date, so an
 * invoice can't stay "overdue" after the money lands. Void and written-off
 * are the two honest endings that aren't payment.
 */
export const INVOICE_STATUSES = [
  { value: "draft", label: "Draft" },
  { value: "sent", label: "Sent" },
  { value: "partially_paid", label: "Partially paid" },
  { value: "paid", label: "Paid" },
  { value: "overdue", label: "Overdue" },
  { value: "void", label: "Void" },
  { value: "written_off", label: "Written off" },
] as const;

/** Statuses that still expect money. */
export const OPEN_INVOICE_STATUSES = ["sent", "partially_paid"];

export const PAYMENT_METHODS = [
  { value: "bank_transfer", label: "Bank transfer" },
  { value: "cash", label: "Cash" },
  { value: "wise", label: "Wise" },
  { value: "paypal", label: "PayPal" },
  { value: "stripe", label: "Stripe" },
  { value: "crypto", label: "Crypto" },
  { value: "other", label: "Other" },
] as const;

export const HANDOVER_KINDS = [
  { value: "login", label: "Login" },
  { value: "domain", label: "Domain" },
  { value: "hosting", label: "Hosting" },
  { value: "design_files", label: "Design files" },
  { value: "code", label: "Code" },
  { value: "docs", label: "Docs" },
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

const values = (opts: readonly { value: string }[]) =>
  z.enum(opts.map((o) => o.value) as [string, ...string[]]);
const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a real date.");

export const projectSchema = z.object({
  client_id: z.string().uuid("Pick a client."),
  name: trimmed.pipe(z.string().min(1, "The project needs a name.")),
  kind: values(PROJECT_KINDS),
  status: values(PROJECT_STATUSES),
  pricing_model: values(PRICING_MODELS),
  description: optional,
  quoted_minor: z.number().int().min(0).nullish(),
  currency: z.enum(CURRENCIES),
  discount_pct: z.coerce.number().min(0).max(100).default(0),
  discount_label: optional,
  start_date: dateStr.nullish(),
  due_date: dateStr.nullish(),
  notes: optional,
  // Backfill only (create): money already collected before this tool existed.
  // Recorded as a standalone payment, not a column on the project.
  collected_minor: z.number().int().min(0).nullish(),
});

export const milestoneSchema = z.object({
  project_id: z.string().uuid(),
  title: trimmed.pipe(z.string().min(1, "Name the milestone.")),
  description: optional,
  due_date: dateStr.nullish(),
  sort_order: z.number().int().default(0),
});

export const changeRequestSchema = z.object({
  project_id: z.string().uuid(),
  title: trimmed.pipe(z.string().min(1, "Name the change.")),
  what_changes: trimmed.pipe(z.string().min(1, "Say what changes.")),
  why: optional,
  timeline_impact: optional,
  price_impact_minor: z.number().int().nullish(),
  currency: z.enum(CURRENCIES).nullish(),
});

export const invoiceItemSchema = z.object({
  title: trimmed.pipe(z.string().min(1, "Every line needs a title.")),
  description: optional,
  quantity: z.coerce.number().positive("Quantity has to be above zero.").default(1),
  unit_minor: z.number().int().min(0),
  sort_order: z.number().int().default(0),
});

export const invoiceSchema = z.object({
  client_id: z.string().uuid("Pick a client."),
  project_id: z.string().uuid().nullish(),
  currency: z.enum(CURRENCIES),
  issue_date: dateStr,
  due_date: dateStr.nullish(),
  // The true-worth pattern: line items carry full value, one named reduction
  // brings the total down. Never a zero line item.
  discount_pct: z.coerce.number().min(0).max(100).default(0),
  discount_label: optional,
  tax_pct: z.coerce.number().min(0).max(100).default(0),
  notes: optional,
  terms: optional,
  items: z.array(invoiceItemSchema).min(1, "An invoice needs at least one line."),
});

export const paymentSchema = z.object({
  client_id: z.string().uuid("Pick a client."),
  project_id: z.string().uuid().nullish(),
  invoice_id: z.string().uuid().nullish(),
  amount_minor: z.number().int().positive("The amount has to be above zero."),
  currency: z.enum(CURRENCIES),
  received_at: dateStr,
  method: values(PAYMENT_METHODS),
  reference: optional,
  notes: optional,
});

/** Per-currency payment instructions rendered onto invoices. */
export const paymentDetailSchema = z.object({
  label: trimmed.pipe(z.string().min(1, "Name the payment route.")),
  lines: z.array(trimmed.pipe(z.string().min(1))).min(1, "Add at least one line."),
});

export const settingsSchema = z.object({
  default_terms: optional,
  default_tax_pct: z.coerce.number().min(0).max(100).default(0),
  // partialRecord: zod v4's record with enum keys demands every currency;
  // a route is only configured for the currencies that have one.
  payment_details: z.partialRecord(z.enum(CURRENCIES), paymentDetailSchema),
});

export const handoverSchema = z.object({
  project_id: z.string().uuid(),
  label: trimmed.pipe(z.string().min(1, "Name the item.")),
  kind: values(HANDOVER_KINDS),
  detail: optional,
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

export type Project = {
  id: string;
  client_id: string;
  name: string;
  kind: string;
  status: string;
  description: string | null;
  tags: string[];
  pricing_model: string;
  quoted_minor: number | null;
  currency: string;
  discount_pct: number;
  discount_label: string | null;
  start_date: string | null;
  due_date: string | null;
  delivered_at: string | null;
  closed_at: string | null;
  notes: string | null;
  created_at: string;
};

export type Milestone = {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  completed_at: string | null;
  sort_order: number;
};

export type ChangeRequest = {
  id: string;
  project_id: string;
  title: string;
  what_changes: string;
  why: string | null;
  timeline_impact: string | null;
  price_impact_minor: number | null;
  currency: string | null;
  status: string;
  sent_at: string | null;
  decided_at: string | null;
};

export type Invoice = {
  id: string;
  client_id: string;
  project_id: string | null;
  number: string;
  status: string;
  currency: string;
  issue_date: string;
  due_date: string | null;
  discount_pct: number;
  discount_label: string | null;
  tax_pct: number;
  notes: string | null;
  terms: string | null;
  fx_rate_to_base: number | null;
  sent_at: string | null;
  paid_at: string | null;
  voided_at: string | null;
  created_at: string;
};

export type InvoiceItem = {
  id: string;
  invoice_id: string;
  title: string;
  description: string | null;
  quantity: number;
  unit_minor: number;
  sort_order: number;
};

export type Payment = {
  id: string;
  client_id: string;
  project_id: string | null;
  invoice_id: string | null;
  amount_minor: number;
  currency: string;
  fx_rate_to_base: number | null;
  received_at: string;
  method: string;
  reference: string | null;
  notes: string | null;
  created_at: string;
};

export type PaymentDetail = { label: string; lines: string[] };

export type StudioSettings = {
  base_currency: string;
  invoice_prefix: string;
  next_invoice_seq: number;
  payment_details: Record<string, PaymentDetail>;
  default_terms: string | null;
  default_tax_pct: number;
};

export type HandoverItem = {
  id: string;
  project_id: string;
  label: string;
  kind: string;
  detail: string | null;
  transferred_at: string | null;
};
