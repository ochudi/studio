import type { Metadata } from "next";
import Link from "next/link";
import { getSupabase } from "@/lib/supabase";
import { RELATIONSHIPS, labelFor, type Client } from "@/lib/domain";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import Chip from "@/components/Chip";

export const metadata: Metadata = { title: "Clients" };
export const dynamic = "force-dynamic";

type Row = Client & { studio_correspondence: { occurred_at: string }[] };

async function loadClients(q: string, archived: boolean) {
  const supabase = getSupabase();
  if (!supabase) return { rows: [] as Row[], archivedCount: 0, ready: false };

  let query = supabase
    .from("studio_clients")
    .select("*, studio_correspondence(occurred_at)")
    .order("name", { ascending: true })
    .order("occurred_at", { referencedTable: "studio_correspondence", ascending: false })
    .limit(1, { referencedTable: "studio_correspondence" });

  query = archived ? query.not("archived_at", "is", null) : query.is("archived_at", null);
  if (q) query = query.or(`name.ilike.%${q}%,company.ilike.%${q}%`);

  const [{ data, error }, { count }] = await Promise.all([
    query,
    supabase
      .from("studio_clients")
      .select("id", { count: "exact", head: true })
      .not("archived_at", "is", null),
  ]);

  if (error) return { rows: [] as Row[], archivedCount: 0, ready: false };
  return { rows: (data ?? []) as Row[], archivedCount: count ?? 0, ready: true };
}

function lastTouch(row: Row): string {
  const at = row.studio_correspondence?.[0]?.occurred_at;
  if (!at) return "No contact logged";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "Africa/Lagos",
  }).format(new Date(at));
}

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: { q?: string; archived?: string };
}) {
  const q = (searchParams.q ?? "").trim();
  const archived = searchParams.archived === "1";
  const { rows, archivedCount, ready } = await loadClients(q, archived);

  return (
    <div>
      <PageHeader
        kicker="Clients"
        title={archived ? "Archived clients" : "Everyone you work with"}
        sub="Each client carries their story: how they arrived, who decides, what channel they prefer, and every conversation on record."
      >
        <Link
          href="/clients/new"
          className="inline-flex items-center rounded-full bg-fg px-5 py-2.5 font-mono text-fluid-xs uppercase tracking-[0.18em] text-bg transition-opacity duration-300 hover:opacity-85"
        >
          New client
        </Link>
      </PageHeader>

      <div className="flex flex-wrap items-center gap-6 border-b border-line px-6 py-4 md:px-10">
        <form method="GET" action="/clients" className="min-w-0 flex-1">
          {archived && <input type="hidden" name="archived" value="1" />}
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Search by name or company"
            aria-label="Search clients"
            className="w-full max-w-sm border-b border-transparent bg-transparent pb-1 text-fluid-sm outline-none transition-colors placeholder:text-muted/60 focus:border-fg"
          />
        </form>
        {archivedCount > 0 && (
          <Link
            href={archived ? "/clients" : "/clients?archived=1"}
            className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted transition-colors hover:text-fg"
          >
            {archived ? "Back to active" : `Archived · ${archivedCount}`}
          </Link>
        )}
      </div>

      <div className="px-6 py-8 md:px-10">
        {!ready ? (
          <EmptyState
            title="The database isn't ready."
            body="Run supabase/migrations/0001_studio_core.sql in the Supabase SQL editor, then reload."
          />
        ) : rows.length === 0 ? (
          <EmptyState
            title={q ? `Nothing matches “${q}”.` : archived ? "The archive is empty." : "No clients yet."}
            body={q || archived ? undefined : "Add the people you already work with first — projects, invoices and the correspondence log all hang off a client record."}
          />
        ) : (
          <ul className="divide-y divide-line border-y border-line">
            {rows.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/clients/${c.id}`}
                  className="group grid grid-cols-1 gap-1 px-2 py-5 transition-colors hover:bg-raised sm:grid-cols-[1fr_auto] sm:items-center sm:gap-6"
                >
                  <div className="min-w-0">
                    <p className="truncate text-fluid-base transition-colors group-hover:text-fg">
                      {c.name}
                      {c.company && <span className="text-muted"> · {c.company}</span>}
                    </p>
                    <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
                      {lastTouch(c)}
                      {c.location ? ` · ${c.location}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {c.relationship !== "standard" && (
                      <Chip>{labelFor(RELATIONSHIPS, c.relationship)}</Chip>
                    )}
                    <Chip className="hidden sm:inline-flex">{c.currency}</Chip>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
