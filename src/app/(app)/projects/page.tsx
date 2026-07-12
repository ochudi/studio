import type { Metadata } from "next";
import Link from "next/link";
import { getSupabase } from "@/lib/supabase";
import {
  PROJECT_KINDS,
  PROJECT_STATUSES,
  LIVE_STATUSES,
  labelFor,
  type Project,
} from "@/lib/domain";
import { formatMinor } from "@/lib/money";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import Chip from "@/components/Chip";

export const metadata: Metadata = { title: "Projects" };
export const dynamic = "force-dynamic";

type Row = Project & {
  studio_clients: { name: string } | null;
  studio_payments: { amount_minor: number; currency: string }[];
};

async function loadProjects(showAll: boolean) {
  const supabase = getSupabase();
  if (!supabase) return { rows: [] as Row[], settledCount: 0, ready: false };

  let query = supabase
    .from("studio_projects")
    .select("*, studio_clients(name), studio_payments(amount_minor, currency)")
    .order("created_at", { ascending: false });
  if (!showAll) query = query.in("status", LIVE_STATUSES);

  const [{ data, error }, { count }] = await Promise.all([
    query,
    supabase
      .from("studio_projects")
      .select("id", { count: "exact", head: true })
      .in("status", ["closed", "lost"]),
  ]);

  if (error) return { rows: [] as Row[], settledCount: 0, ready: false };
  return { rows: (data ?? []) as Row[], settledCount: count ?? 0, ready: true };
}

/** Payments in the project's own currency; mixed currencies settle in chunk 4. */
function collectedMinor(p: Row): number {
  return p.studio_payments
    .filter((pay) => pay.currency === p.currency)
    .reduce((sum, pay) => sum + Number(pay.amount_minor), 0);
}

function moneyLine(p: Row): string | null {
  const collected = collectedMinor(p);
  if (p.quoted_minor) {
    if (collected >= p.quoted_minor) return `${formatMinor(p.quoted_minor, p.currency)} · paid in full`;
    if (collected > 0)
      return `${formatMinor(collected, p.currency)} of ${formatMinor(p.quoted_minor, p.currency)}`;
    return formatMinor(p.quoted_minor, p.currency);
  }
  return collected > 0 ? `${formatMinor(collected, p.currency)} collected` : null;
}

const dueFmt = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  timeZone: "Africa/Lagos",
});

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: { all?: string };
}) {
  const showAll = searchParams.all === "1";
  const { rows, settledCount, ready } = await loadProjects(showAll);

  const groups = PROJECT_STATUSES.map((s) => ({
    ...s,
    projects: rows.filter((p) => p.status === s.value),
  })).filter((g) => g.projects.length > 0);

  return (
    <div>
      <PageHeader
        kicker="Projects"
        title="The pipeline"
        sub="Every engagement in stage order, lead to closeout. Each one carries its milestones, decisions, money and handover."
      >
        <Link
          href="/projects/new"
          className="inline-flex items-center rounded-full bg-fg px-5 py-2.5 font-mono text-fluid-xs uppercase tracking-[0.18em] text-bg transition-opacity duration-300 hover:opacity-85"
        >
          New project
        </Link>
      </PageHeader>

      {settledCount > 0 && (
        <div className="flex justify-end border-b border-line px-6 py-4 md:px-10">
          <Link
            href={showAll ? "/projects" : "/projects?all=1"}
            className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted transition-colors hover:text-fg"
          >
            {showAll ? "Live pipeline only" : `Closed & lost · ${settledCount}`}
          </Link>
        </div>
      )}

      <div className="px-6 py-8 md:px-10">
        {!ready ? (
          <EmptyState
            title="The database isn't ready."
            body="Run supabase/migrations/0001_studio_core.sql in the Supabase SQL editor, then reload."
          />
        ) : groups.length === 0 ? (
          <EmptyState
            title="Nothing in the pipeline."
            body="Add the work you already have in flight — status, quote and money collected can all be backfilled, nothing assumes a clean start."
          />
        ) : (
          <div className="space-y-10">
            {groups.map((g) => (
              <section key={g.value} aria-label={g.label}>
                <h2 className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted">
                  {g.label} · {g.projects.length}
                </h2>
                <ul className="mt-3 divide-y divide-line border-y border-line">
                  {g.projects.map((p) => {
                    const money = moneyLine(p);
                    return (
                      <li key={p.id}>
                        <Link
                          href={`/projects/${p.id}`}
                          className="group grid grid-cols-1 gap-1 px-2 py-5 transition-colors hover:bg-raised sm:grid-cols-[1fr_auto] sm:items-center sm:gap-6"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-fluid-base">
                              {p.name}
                              {p.studio_clients?.name && (
                                <span className="text-muted"> · {p.studio_clients.name}</span>
                              )}
                            </p>
                            <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
                              {labelFor(PROJECT_KINDS, p.kind)}
                              {money ? ` · ${money}` : ""}
                              {p.due_date
                                ? ` · due ${dueFmt.format(new Date(p.due_date + "T12:00:00Z"))}`
                                : ""}
                            </p>
                          </div>
                          <div className="hidden items-center gap-2 sm:flex">
                            <Chip>{p.currency}</Chip>
                          </div>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
