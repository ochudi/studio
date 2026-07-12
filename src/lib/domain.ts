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

/** Creatable document kinds; receipt/signed_contract/invoice_pdf are system rows. */
export const DOC_KINDS = [
  { value: "proposal", label: "Proposal" },
  { value: "contract", label: "Contract" },
  { value: "onboarding", label: "Onboarding pack" },
  { value: "brief", label: "Brief" },
  { value: "handover", label: "Handover doc" },
  { value: "other", label: "Other" },
] as const;

export const DOC_STATUSES = [
  { value: "draft", label: "Draft" },
  { value: "sent", label: "Sent" },
  { value: "signed", label: "Signed" },
  { value: "archived", label: "Archived" },
] as const;

/** Mirrors studio_expenses_category_check. */
export const EXPENSE_CATEGORIES = [
  { value: "software", label: "Software" },
  { value: "hosting", label: "Hosting" },
  { value: "domains", label: "Domains" },
  { value: "fonts_stock", label: "Fonts & stock" },
  { value: "contractor", label: "Contractor" },
  { value: "equipment", label: "Equipment" },
  { value: "transport", label: "Transport" },
  { value: "data_airtime", label: "Data & airtime" },
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

/** Mirrors studio_events_kind_check. */
export const EVENT_KINDS = [
  { value: "call", label: "Call" },
  { value: "meeting", label: "Meeting" },
  { value: "deadline", label: "Deadline" },
  { value: "reminder", label: "Reminder" },
  { value: "other", label: "Other" },
] as const;

export const EVENT_STATUSES = [
  { value: "scheduled", label: "Scheduled" },
  { value: "done", label: "Done" },
  { value: "cancelled", label: "Cancelled" },
  { value: "no_show", label: "No-show" },
] as const;

/** Reminder offsets offered in the event form, in minutes before start. */
export const REMIND_OPTIONS = [
  { value: 10080, label: "A week before" },
  { value: 1440, label: "A day before" },
  { value: 60, label: "An hour before" },
  { value: 15, label: "15 minutes before" },
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

export const expenseSchema = z.object({
  project_id: z.string().uuid().nullish(),
  title: trimmed.pipe(z.string().min(1, "Say what the money bought.")),
  category: values(EXPENSE_CATEGORIES),
  amount_minor: z.number().int().positive("The amount has to be above zero."),
  currency: z.enum(CURRENCIES),
  spent_at: dateStr,
  billable: z.boolean().default(false),
  receipt_document_id: z.string().uuid().nullish(),
  notes: optional,
});

/** The block contract, enforced at the API boundary before content lands. */
const blockSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("heading"), text: z.string() }),
  z.object({ type: z.literal("text"), text: z.string() }),
  z.object({ type: z.literal("list"), items: z.array(z.string()) }),
  z.object({
    type: z.literal("pricing"),
    currency: z.enum(CURRENCIES),
    rows: z.array(
      z.object({
        label: z.string(),
        detail: z.string(),
        amount_minor: z.number().int().min(0).nullable(),
      })
    ),
  }),
  z.object({ type: z.literal("questions"), items: z.array(z.string()) }),
  z.object({
    type: z.literal("signatures"),
    parties: z.array(z.object({ label: z.string(), name: z.string() })),
  }),
]);

export const docContentSchema = z.object({
  blocks: z.array(blockSchema).min(1, "A document needs at least one block."),
});

export const documentCreateSchema = z.object({
  client_id: z.string().uuid().nullish(),
  project_id: z.string().uuid().nullish(),
  kind: values(DOC_KINDS),
  title: trimmed.pipe(z.string().min(1, "Name the document.")),
  template_id: z.string().uuid().nullish(),
  duplicate_of: z.string().uuid().nullish(),
});

export const documentEditSchema = z.object({
  title: trimmed.pipe(z.string().min(1, "Name the document.")),
  content: docContentSchema,
});

export const templateEditSchema = z.object({
  name: trimmed.pipe(z.string().min(1, "Name the template.")),
  content: docContentSchema,
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

export const eventSchema = z.object({
  client_id: z.string().uuid().nullish(),
  project_id: z.string().uuid().nullish(),
  title: trimmed.pipe(z.string().min(1, "Name the event.")),
  kind: values(EVENT_KINDS),
  starts_at: z.string().datetime({ offset: true }),
  ends_at: z.string().datetime({ offset: true }).nullish(),
  location: optional,
  agenda: optional,
  remind_minutes: z.array(z.number().int().positive()).max(4).default([1440, 60]),
});

/** Closing out an event; scheduled is never a destination. */
export const eventCloseSchema = z.object({
  status: z.enum(["done", "cancelled", "no_show"]),
  outcome: optional,
});

export const pushSubscriptionSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({ p256dh: z.string().min(1), auth: z.string().min(1) }),
  device_label: optional,
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

export type StudioDocument = {
  id: string;
  client_id: string | null;
  project_id: string | null;
  kind: string;
  title: string;
  source: string;
  template_id: string | null;
  content: unknown;
  status: string;
  storage_path: string | null;
  mime_type: string | null;
  size_bytes: number | null;
  sent_at: string | null;
  signed_at: string | null;
  created_at: string;
};

export type DocTemplate = {
  id: string;
  kind: string;
  name: string;
  content: unknown;
  is_default: boolean;
};

export type Expense = {
  id: string;
  project_id: string | null;
  title: string;
  category: string;
  amount_minor: number;
  currency: string;
  fx_rate_to_base: number | null;
  spent_at: string;
  billable: boolean;
  receipt_document_id: string | null;
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

export type StudioEvent = {
  id: string;
  client_id: string | null;
  project_id: string | null;
  title: string;
  kind: string;
  starts_at: string;
  ends_at: string | null;
  location: string | null;
  agenda: string | null;
  outcome: string | null;
  status: string;
  remind_minutes: number[];
  created_at: string;
  updated_at: string;
};

export type Reminder = {
  id: string;
  due_at: string;
  kind: string;
  title: string;
  body: string | null;
  url: string | null;
  client_id: string | null;
  project_id: string | null;
  event_id: string | null;
  sent_at: string | null;
  channels: string[];
  created_at: string;
};

export type PushDevice = {
  id: string;
  endpoint: string;
  device_label: string | null;
  created_at: string;
  last_used_at: string | null;
};
