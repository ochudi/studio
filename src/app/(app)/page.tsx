import Link from "next/link";
import { getSupabase } from "@/lib/supabase";
import { formatMinor } from "@/lib/money";
import { OPEN_INVOICE_STATUSES } from "@/lib/domain";
import { invoiceTotals, paidMinor } from "@/lib/invoice";
import EmptyState from "@/components/EmptyState";
import Chip from "@/components/Chip";

export const dynamic = "force-dynamic";

/**
 * Today — the landing surface. Answers three questions the moment it opens:
 * what's live, what's owed, and what happens next. Every number is a straight
 * read of the database; when Supabase isn't configured it degrades to a
 * setup note instead of fake zeros.
 */

type FollowUp = {
  id: string;
  client_id: string;
  summary: string;
  follow_up_on: string;
  studio_clients: { name: string } | null;
};

type DueMilestone = {
  id: string;
  due_date: string;
  title: string;
  studio_projects: { id: string; name: string } | null;
};

/** Follow-ups and due milestones interleave into one date-ordered queue. */
type Move = {
  key: string;
  href: string;
  context: string | null;
  text: string;
  date: string;
};

type Snapshot = {
  activeProjects: number;
  clientCount: number;
  outstanding: { currency: string; minor: number }[];
  nextEvent: { title: string; starts_at: string } | null;
  moves: Move[];
  configured: boolean;
};

const EMPTY: Snapshot = {
  activeProjects: 0,
  clientCount: 0,
  outstanding: [],
  nextEvent: null,
  moves: [],
  configured: false,
};

function horizonDate(days: number): string {
  const d = new Date(Date.now() + days * 86400000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Lagos" }).format(d);
}

async function loadSnapshot(): Promise<Snapshot> {
  const supabase = getSupabase();
  if (!supabase) {
    return EMPTY;
  }

  const [projects, invoices, events, clients, followUps, milestones] = await Promise.all([
    supabase
      .from("studio_projects")
      .select("id", { count: "exact", head: true })
      .in("status", ["onboarding", "active", "in_review"]),
    supabase
      .from("studio_invoices")
      .select(
        "currency, discount_pct, tax_pct, studio_invoice_items(quantity, unit_minor), studio_payments(amount_minor, currency)"
      )
      .in("status", OPEN_INVOICE_STATUSES),
    supabase
      .from("studio_events")
      .select("title, starts_at")
      .eq("status", "scheduled")
      .gte("starts_at", new Date().toISOString())
      .order("starts_at", { ascending: true })
      .limit(1),
    supabase
      .from("studio_clients")
      .select("id", { count: "exact", head: true })
      .is("archived_at", null),
    supabase
      .from("studio_correspondence")
      .select("id, client_id, summary, follow_up_on, studio_clients(name)")
      .not("follow_up_on", "is", null)
      .order("follow_up_on", { ascending: true })
      .limit(8),
    supabase
      .from("studio_milestones")
      .select("id, title, due_date, studio_projects(id, name)")
      .is("completed_at", null)
      .not("due_date", "is", null)
      .lte("due_date", horizonDate(7))
      .order("due_date", { ascending: true })
      .limit(8),
  ]);

  // What's actually still owed: invoice totals minus what has already landed.
  const byCurrency = new Map<string, number>();
  for (const inv of invoices.data ?? []) {
    const { total } = invoiceTotals(
      inv.studio_invoice_items ?? [],
      Number(inv.discount_pct ?? 0),
      Number(inv.tax_pct ?? 0)
    );
    const balance = Math.max(0, total - paidMinor(inv.studio_payments ?? [], inv.currency));
    if (balance > 0) {
      byCurrency.set(inv.currency, (byCurrency.get(inv.currency) ?? 0) + balance);
    }
  }

  const moves: Move[] = [
    ...((followUps.data ?? []) as unknown as FollowUp[]).map((f) => ({
      key: `follow:${f.id}`,
      href: `/clients/${f.client_id}`,
      context: f.studio_clients?.name ?? null,
      text: f.summary,
      date: f.follow_up_on,
    })),
    ...((milestones.data ?? []) as unknown as DueMilestone[]).map((m) => ({
      key: `milestone:${m.id}`,
      href: m.studio_projects ? `/projects/${m.studio_projects.id}` : "/projects",
      context: m.studio_projects?.name ?? null,
      text: m.title,
      date: m.due_date,
    })),
  ]
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 8);

  return {
    activeProjects: projects.count ?? 0,
    clientCount: clients.count ?? 0,
    outstanding: Array.from(byCurrency, ([currency, minor]) => ({ currency, minor })),
    nextEvent: events.data?.[0] ?? null,
    moves,
    configured: true,
  };
}

function lagosToday(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Lagos" }).format(new Date());
}

const followFmt = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  timeZone: "Africa/Lagos",
});

function todayInLagos(): string {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "Africa/Lagos",
  }).format(new Date());
}

export default async function TodayPage() {
  const snap = await loadSnapshot();

  return (
    <div>
      <header className="px-6 pb-8 pt-8 md:px-10 md:pt-12">
        <p className="font-mono text-fluid-xs uppercase tracking-[0.18em] text-muted">
          {todayInLagos()}
        </p>
        <h1 className="mt-2 font-display tracking-tightest text-fluid-3xl leading-[1.02]">
          Today
        </h1>
      </header>

      <section aria-label="Snapshot" className="grid grid-cols-1 gap-px border-y border-line bg-line sm:grid-cols-3">
        <div className="bg-bg px-6 py-6 md:px-10">
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted">
            Active projects
          </p>
          <p className="tnum mt-2 font-display text-fluid-2xl tracking-tightest">
            {snap.activeProjects}
          </p>
        </div>
        <div className="bg-bg px-6 py-6 md:px-10">
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted">
            Outstanding
          </p>
          {snap.outstanding.length === 0 ? (
            <p className="tnum mt-2 font-display text-fluid-2xl tracking-tightest text-muted">
              Nothing owed
            </p>
          ) : (
            <p className="tnum mt-2 font-display text-fluid-2xl tracking-tightest">
              {snap.outstanding.map((o) => formatMinor(o.minor, o.currency)).join(" · ")}
            </p>
          )}
        </div>
        <div className="bg-bg px-6 py-6 md:px-10">
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted">
            Next call
          </p>
          {snap.nextEvent ? (
            <p className="mt-2 font-display text-fluid-2xl tracking-tightest">
              {snap.nextEvent.title}
            </p>
          ) : (
            <p className="mt-2 font-display text-fluid-2xl tracking-tightest text-muted">
              Clear diary
            </p>
          )}
        </div>
      </section>

      <section aria-label="Next moves" className="px-6 py-10 md:px-10">
        <p className="font-mono text-fluid-xs uppercase tracking-[0.18em] text-muted">
          Next moves
        </p>
        <div className="mt-4">
          {!snap.configured ? (
            <EmptyState
              title="Supabase isn't connected."
              body="Copy .env.example to .env.local, reuse the site's SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY, and run the migration in supabase/migrations."
            />
          ) : snap.moves.length > 0 ? (
            <ul className="divide-y divide-line border-y border-line">
              {snap.moves.map((m) => {
                const overdue = m.date <= lagosToday();
                return (
                  <li key={m.key}>
                    <Link
                      href={m.href}
                      className="flex items-center justify-between gap-4 px-2 py-4 transition-colors hover:bg-raised"
                    >
                      <p className="min-w-0 truncate text-fluid-sm">
                        {m.context && <span className="text-muted">{m.context} · </span>}
                        {m.text}
                      </p>
                      <Chip filled={overdue}>
                        {overdue ? "Due" : ""} {followFmt.format(new Date(m.date + "T12:00:00Z"))}
                      </Chip>
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : snap.clientCount === 0 ? (
            <EmptyState
              title="Start with a client."
              body="Add the people you already work with — everything else hangs off their record, including the projects already in flight."
            />
          ) : (
            <EmptyState
              title="Nothing queued."
              body="Log conversations with a follow-up date and they line up here. Suggested, never sent without you."
            />
          )}
        </div>
      </section>
    </div>
  );
}
