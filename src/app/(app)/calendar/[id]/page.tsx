import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getSupabase } from "@/lib/supabase";
import { labelFor, EVENT_KINDS, EVENT_STATUSES, CHANNELS, OPEN_INVOICE_STATUSES } from "@/lib/domain";
import { invoiceTotals, paidMinor } from "@/lib/invoice";
import { formatMinor } from "@/lib/money";
import PageHeader from "@/components/PageHeader";
import EventActions from "@/components/EventActions";
import Chip from "@/components/Chip";

export const metadata: Metadata = { title: "Event" };
export const dynamic = "force-dynamic";

/**
 * One event, with everything you'd want open before you dial: the last few
 * things said, what they still owe, and what's due on the project. The
 * context card only shows for scheduled events — afterwards the outcome is
 * the story.
 */

const LAGOS = "Africa/Lagos";

const whenFmt = new Intl.DateTimeFormat("en-GB", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: LAGOS,
});
const timeFmt = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: LAGOS,
});
const shortFmt = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  timeZone: LAGOS,
});

type ContextData = {
  correspondence: { id: string; summary: string; channel: string; direction: string; occurred_at: string }[];
  openInvoices: { id: string; number: string; currency: string; balance: number }[];
  openMilestones: { id: string; title: string; due_date: string | null }[];
};

async function loadContext(
  supabase: NonNullable<ReturnType<typeof getSupabase>>,
  clientId: string | null,
  projectId: string | null
): Promise<ContextData> {
  const [corr, invoices, milestones] = await Promise.all([
    clientId
      ? supabase
          .from("studio_correspondence")
          .select("id, summary, channel, direction, occurred_at")
          .eq("client_id", clientId)
          .order("occurred_at", { ascending: false })
          .limit(3)
      : Promise.resolve({ data: [] }),
    clientId
      ? supabase
          .from("studio_invoices")
          .select(
            "id, number, currency, discount_pct, tax_pct, studio_invoice_items(quantity, unit_minor), studio_payments(amount_minor, currency)"
          )
          .eq("client_id", clientId)
          .in("status", OPEN_INVOICE_STATUSES)
      : Promise.resolve({ data: [] }),
    projectId
      ? supabase
          .from("studio_milestones")
          .select("id, title, due_date")
          .eq("project_id", projectId)
          .is("completed_at", null)
          .order("due_date", { ascending: true, nullsFirst: false })
          .limit(4)
      : Promise.resolve({ data: [] }),
  ]);

  const openInvoices = ((invoices.data ?? []) as unknown as {
    id: string;
    number: string;
    currency: string;
    discount_pct: number;
    tax_pct: number;
    studio_invoice_items: { quantity: number; unit_minor: number }[];
    studio_payments: { amount_minor: number; currency: string }[];
  }[])
    .map((inv) => {
      const { total } = invoiceTotals(
        inv.studio_invoice_items ?? [],
        Number(inv.discount_pct ?? 0),
        Number(inv.tax_pct ?? 0)
      );
      return {
        id: inv.id,
        number: inv.number,
        currency: inv.currency,
        balance: total - paidMinor(inv.studio_payments ?? [], inv.currency),
      };
    })
    .filter((inv) => inv.balance > 0);

  return {
    correspondence: (corr.data ?? []) as ContextData["correspondence"],
    openMilestones: (milestones.data ?? []) as ContextData["openMilestones"],
    openInvoices,
  };
}

export default async function EventPage({ params }: { params: { id: string } }) {
  const supabase = getSupabase();
  if (!supabase) notFound();

  const event = (
    await supabase
      .from("studio_events")
      .select("*, studio_clients(id, name, email), studio_projects(id, name)")
      .eq("id", params.id)
      .maybeSingle()
  ).data;
  if (!event) notFound();

  const client = event.studio_clients as unknown as { id: string; name: string; email: string | null } | null;
  const project = event.studio_projects as unknown as { id: string; name: string } | null;
  const scheduled = event.status === "scheduled";
  const context = scheduled
    ? await loadContext(supabase, event.client_id, event.project_id)
    : null;

  const starts = new Date(event.starts_at);
  const when = `${whenFmt.format(starts)} · ${timeFmt.format(starts)}${
    event.ends_at ? `–${timeFmt.format(new Date(event.ends_at))}` : ""
  }`;

  return (
    <div>
      <PageHeader kicker={`Calendar · ${labelFor(EVENT_KINDS, event.kind)}`} title={event.title} sub={when}>
        <Chip filled={scheduled}>{labelFor(EVENT_STATUSES, event.status)}</Chip>
      </PageHeader>

      <section aria-label="Details" className="border-b border-line px-6 py-6 md:px-10">
        <dl className="grid grid-cols-2 gap-x-8 gap-y-5 sm:grid-cols-4">
          <div>
            <dt className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted">Client</dt>
            <dd className="mt-1 text-fluid-sm">
              {client ? (
                <Link href={`/clients/${client.id}`} className="underline decoration-line underline-offset-4 transition-colors hover:decoration-fg">
                  {client.name}
                </Link>
              ) : (
                <span className="text-muted">None</span>
              )}
            </dd>
          </div>
          <div>
            <dt className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted">Project</dt>
            <dd className="mt-1 text-fluid-sm">
              {project ? (
                <Link href={`/projects/${project.id}`} className="underline decoration-line underline-offset-4 transition-colors hover:decoration-fg">
                  {project.name}
                </Link>
              ) : (
                <span className="text-muted">None</span>
              )}
            </dd>
          </div>
          <div>
            <dt className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted">Where</dt>
            <dd className="mt-1 text-fluid-sm">{event.location ?? <span className="text-muted">Not set</span>}</dd>
          </div>
          <div>
            <dt className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted">Reminders</dt>
            <dd className="mt-1 text-fluid-sm">
              {scheduled && (event.remind_minutes ?? []).length > 0 ? (
                (event.remind_minutes as number[])
                  .slice()
                  .sort((a, b) => b - a)
                  .map((m) =>
                    m >= 10080 ? "1w" : m >= 1440 ? `${Math.round(m / 1440)}d` : m >= 60 ? `${Math.round(m / 60)}h` : `${m}m`
                  )
                  .join(" · ") + " before"
              ) : (
                <span className="text-muted">None</span>
              )}
            </dd>
          </div>
        </dl>
      </section>

      {event.agenda && (
        <section aria-label="Agenda" className="border-b border-line px-6 py-6 md:px-10">
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted">Agenda</p>
          <p className="mt-2 max-w-[64ch] whitespace-pre-line text-fluid-sm leading-relaxed">{event.agenda}</p>
        </section>
      )}

      {event.outcome && (
        <section aria-label="Outcome" className="border-b border-line px-6 py-6 md:px-10">
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted">What came out of it</p>
          <p className="mt-2 max-w-[64ch] whitespace-pre-line text-fluid-sm leading-relaxed">{event.outcome}</p>
        </section>
      )}

      <section aria-label="Actions" className="border-b border-line px-6 py-6 md:px-10">
        <EventActions
          eventId={event.id}
          status={event.status}
          outcome={event.outcome}
          clientId={client?.id ?? null}
          clientName={client?.name ?? null}
          clientEmail={client?.email ?? null}
        />
      </section>

      {context &&
        (context.correspondence.length > 0 ||
          context.openInvoices.length > 0 ||
          context.openMilestones.length > 0) && (
          <section aria-label="Before you dial" className="px-6 py-8 md:px-10">
            <p className="font-mono text-fluid-xs uppercase tracking-[0.18em] text-muted">Before you dial</p>
            <div className="mt-4 grid gap-px border border-line bg-line md:grid-cols-3">
              <div className="bg-bg p-5">
                <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted">Last said</p>
                {context.correspondence.length === 0 ? (
                  <p className="mt-3 text-fluid-sm text-muted">Nothing logged yet.</p>
                ) : (
                  <ul className="mt-3 space-y-3">
                    {context.correspondence.map((c) => (
                      <li key={c.id} className="text-fluid-sm leading-snug">
                        <span className="tnum font-mono text-[10px] uppercase tracking-[0.12em] text-muted">
                          {shortFmt.format(new Date(c.occurred_at))} · {labelFor(CHANNELS, c.channel)}{" "}
                          {c.direction === "in" ? "in" : "out"}
                        </span>
                        <span className="mt-0.5 block">{c.summary}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="bg-bg p-5">
                <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted">Still owed</p>
                {context.openInvoices.length === 0 ? (
                  <p className="mt-3 text-fluid-sm text-muted">Nothing outstanding.</p>
                ) : (
                  <ul className="mt-3 space-y-3">
                    {context.openInvoices.map((inv) => (
                      <li key={inv.id}>
                        <Link href={`/money/invoices/${inv.id}`} className="flex items-baseline justify-between gap-3 text-fluid-sm transition-colors hover:text-fg">
                          <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted">
                            {inv.number}
                          </span>
                          <span className="tnum whitespace-nowrap">{formatMinor(inv.balance, inv.currency)}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="bg-bg p-5">
                <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted">Open on the project</p>
                {context.openMilestones.length === 0 ? (
                  <p className="mt-3 text-fluid-sm text-muted">No open milestones.</p>
                ) : (
                  <ul className="mt-3 space-y-3">
                    {context.openMilestones.map((m) => (
                      <li key={m.id} className="flex items-baseline justify-between gap-3 text-fluid-sm">
                        <span className="min-w-0 truncate">{m.title}</span>
                        {m.due_date && (
                          <span className="tnum whitespace-nowrap font-mono text-[10px] uppercase tracking-[0.12em] text-muted">
                            {shortFmt.format(new Date(m.due_date + "T12:00:00Z"))}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </section>
        )}
    </div>
  );
}
