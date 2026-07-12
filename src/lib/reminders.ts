import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { labelFor, EVENT_KINDS, type StudioEvent } from "@/lib/domain";
import { OPEN_INVOICE_STATUSES } from "@/lib/domain";
import { invoiceTotals, paidMinor } from "@/lib/invoice";
import { formatMinor } from "@/lib/money";
import { sendPush } from "@/lib/push";
import { sendEmail } from "@/lib/email";

/**
 * The reminder pipeline. Rows in studio_reminders are materialised when an
 * event is created or rescheduled (not at send time), so the cron sweep is a
 * dumb drain: anything due and unsent goes out and gets stamped. The table
 * doubles as the authoritative notification log — pushes can drop silently,
 * the rows don't.
 */

const LAGOS = "Africa/Lagos";

const timeFmt = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: LAGOS,
});

function lagosDate(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: LAGOS }).format(d);
}

function lagosHour(d: Date): number {
  return Number(
    new Intl.DateTimeFormat("en-GB", { hour: "numeric", hourCycle: "h23", timeZone: LAGOS }).format(d)
  );
}

/**
 * Rebuilds the unsent reminders for an event from its remind_minutes.
 * Already-sent rows stay put — they're the log — and offsets already in the
 * past are skipped rather than fired late.
 */
export async function syncEventReminders(
  supabase: SupabaseClient,
  event: Pick<StudioEvent, "id" | "client_id" | "project_id" | "title" | "kind" | "starts_at" | "status" | "remind_minutes">
): Promise<void> {
  await supabase.from("studio_reminders").delete().eq("event_id", event.id).is("sent_at", null);
  if (event.status !== "scheduled") return;

  const starts = Date.parse(event.starts_at);
  const rows = (event.remind_minutes ?? [])
    .map((m) => new Date(starts - m * 60000))
    .filter((due) => due.getTime() > Date.now())
    .map((due) => ({
      due_at: due.toISOString(),
      kind: "event",
      title: event.title,
      body: `${labelFor(EVENT_KINDS, event.kind)} · ${timeFmt.format(new Date(event.starts_at))} Lagos`,
      url: `/calendar/${event.id}`,
      client_id: event.client_id,
      project_id: event.project_id,
      event_id: event.id,
      channels: ["push"],
    }));

  if (rows.length > 0) {
    await supabase.from("studio_reminders").insert(rows);
  }
}

type DueReminder = {
  id: string;
  title: string;
  body: string | null;
  url: string | null;
  channels: string[];
  studio_events: { starts_at: string; status: string } | null;
};

/** Drains due reminders. Called by cron every 5 minutes and on app open. */
export async function drainReminders(supabase: SupabaseClient): Promise<{ sent: number; skipped: number }> {
  const now = new Date().toISOString();
  const due = ((
    await supabase
      .from("studio_reminders")
      .select("id, title, body, url, channels, studio_events(starts_at, status)")
      .is("sent_at", null)
      .lte("due_at", now)
      .limit(20)
  ).data ?? []) as unknown as DueReminder[];

  let sent = 0;
  let skipped = 0;
  for (const r of due) {
    const ev = r.studio_events;
    // A reminder for a call that already happened (or was cancelled) is
    // noise — stamp it without pushing so it can't fire on the next tick.
    const stale =
      ev && (ev.status !== "scheduled" || Date.parse(ev.starts_at) < Date.now() - 60 * 60000);
    if (!stale) {
      await sendPush(supabase, { title: r.title, body: r.body ?? undefined, url: r.url ?? undefined });
      if (r.channels?.includes("email")) {
        await sendEmail({ subject: r.title, text: r.body ?? r.title });
      }
      sent++;
    } else {
      skipped++;
    }
    await supabase.from("studio_reminders").update({ sent_at: new Date().toISOString() }).eq("id", r.id);
  }
  return { sent, skipped };
}

/**
 * The 8am Lagos digest: today's diary, what's overdue, which proposals are
 * still out. Fires once per Lagos day — the inserted reminder row is both
 * the log entry and the "already sent today" marker.
 */
export async function sendDigestIfDue(supabase: SupabaseClient): Promise<boolean> {
  const now = new Date();
  if (lagosHour(now) < 8) return false;

  const dayStart = new Date(`${lagosDate(now)}T00:00:00+01:00`);
  const dayEnd = new Date(dayStart.getTime() + 86400000);

  const already = await supabase
    .from("studio_reminders")
    .select("id")
    .eq("kind", "digest")
    .gte("due_at", dayStart.toISOString())
    .limit(1);
  if ((already.data ?? []).length > 0) return false;

  const [events, invoices, proposals] = await Promise.all([
    supabase
      .from("studio_events")
      .select("title, kind, starts_at")
      .eq("status", "scheduled")
      .gte("starts_at", dayStart.toISOString())
      .lt("starts_at", dayEnd.toISOString())
      .order("starts_at"),
    supabase
      .from("studio_invoices")
      .select(
        "number, currency, due_date, discount_pct, tax_pct, studio_clients(name), studio_invoice_items(quantity, unit_minor), studio_payments(amount_minor, currency)"
      )
      .in("status", OPEN_INVOICE_STATUSES)
      .not("due_date", "is", null)
      .lt("due_date", lagosDate(now)),
    supabase.from("studio_projects").select("name").eq("status", "proposal_sent"),
  ]);

  const overdue = (invoices.data ?? []).flatMap((inv) => {
    const { total } = invoiceTotals(
      inv.studio_invoice_items ?? [],
      Number(inv.discount_pct ?? 0),
      Number(inv.tax_pct ?? 0)
    );
    const balance = total - paidMinor(inv.studio_payments ?? [], inv.currency);
    if (balance <= 0) return [];
    const client = (inv.studio_clients as unknown as { name: string } | null)?.name;
    return [`${inv.number}${client ? ` · ${client}` : ""} · ${formatMinor(balance, inv.currency)} owed`];
  });

  const lines: string[] = [];
  for (const e of events.data ?? []) {
    lines.push(`${timeFmt.format(new Date(e.starts_at))} · ${labelFor(EVENT_KINDS, e.kind)} · ${e.title}`);
  }
  lines.push(...overdue);
  for (const p of proposals.data ?? []) {
    lines.push(`Proposal still out · ${p.name}`);
  }
  if (lines.length === 0) return false;

  const counts = [
    (events.data ?? []).length > 0 ? `${(events.data ?? []).length} on the diary` : null,
    overdue.length > 0 ? `${overdue.length} overdue` : null,
    (proposals.data ?? []).length > 0 ? `${(proposals.data ?? []).length} proposals out` : null,
  ].filter(Boolean);

  const title = "This morning";
  const body = counts.join(" · ");
  const nowIso = new Date().toISOString();

  await supabase.from("studio_reminders").insert({
    due_at: nowIso,
    kind: "digest",
    title,
    body: lines.join("\n"),
    url: "/",
    channels: ["push", "email"],
    sent_at: nowIso,
  });
  await sendPush(supabase, { title, body, url: "/" });
  await sendEmail({ subject: `${title} — ${body}`, text: lines.join("\n") });
  return true;
}

/** One tick: drain what's due, then the digest if the morning has arrived. */
export async function sweep(supabase: SupabaseClient): Promise<{ sent: number; skipped: number; digest: boolean }> {
  const drained = await drainReminders(supabase);
  const digest = await sendDigestIfDue(supabase);
  return { ...drained, digest };
}
