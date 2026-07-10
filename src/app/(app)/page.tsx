import Link from "next/link";
import { getSupabase } from "@/lib/supabase";
import { formatMinor } from "@/lib/money";
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

type Snapshot = {
  activeProjects: number;
  clientCount: number;
  outstanding: { currency: string; minor: number }[];
  nextEvent: { title: string; starts_at: string } | null;
  followUps: FollowUp[];
  configured: boolean;
};

const EMPTY: Snapshot = {
  activeProjects: 0,
  clientCount: 0,
  outstanding: [],
  nextEvent: null,
  followUps: [],
  configured: false,
};

async function loadSnapshot(): Promise<Snapshot> {
  const supabase = getSupabase();
  if (!supabase) {
    return EMPTY;
  }

  const [projects, invoices, events, clients, followUps] = await Promise.all([
    supabase
      .from("studio_projects")
      .select("id", { count: "exact", head: true })
      .in("status", ["onboarding", "active", "in_review"]),
    supabase
      .from("studio_invoices")
      .select("currency, studio_invoice_items(quantity, unit_minor), discount_pct, tax_pct")
      .in("status", ["sent", "partially_paid", "overdue"]),
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
  ]);

  const byCurrency = new Map<string, number>();
  for (const inv of invoices.data ?? []) {
    const items = (inv.studio_invoice_items ?? []) as { quantity: number; unit_minor: number }[];
    const gross = items.reduce((sum, it) => sum + Number(it.quantity) * Number(it.unit_minor), 0);
    const net = Math.round(
      gross * (1 - Number(inv.discount_pct ?? 0) / 100) * (1 + Number(inv.tax_pct ?? 0) / 100)
    );
    byCurrency.set(inv.currency, (byCurrency.get(inv.currency) ?? 0) + net);
  }

  return {
    activeProjects: projects.count ?? 0,
    clientCount: clients.count ?? 0,
    outstanding: Array.from(byCurrency, ([currency, minor]) => ({ currency, minor })),
    nextEvent: events.data?.[0] ?? null,
    followUps: (followUps.data ?? []) as unknown as FollowUp[],
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
          ) : snap.followUps.length > 0 ? (
            <ul className="divide-y divide-line border-y border-line">
              {snap.followUps.map((f) => {
                const overdue = f.follow_up_on <= lagosToday();
                return (
                  <li key={f.id}>
                    <Link
                      href={`/clients/${f.client_id}`}
                      className="flex items-center justify-between gap-4 px-2 py-4 transition-colors hover:bg-raised"
                    >
                      <p className="min-w-0 truncate text-fluid-sm">
                        {f.studio_clients?.name && (
                          <span className="text-muted">{f.studio_clients.name} · </span>
                        )}
                        {f.summary}
                      </p>
                      <Chip filled={overdue}>
                        {overdue ? "Due" : ""} {followFmt.format(new Date(f.follow_up_on + "T12:00:00Z"))}
                      </Chip>
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : snap.clientCount === 0 ? (
            <EmptyState
              title="Start with a client."
              body="Add the people you already work with — everything else hangs off their record. The projects you've collected payment for come in the next chunk."
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
