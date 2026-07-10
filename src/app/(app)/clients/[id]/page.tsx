import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getSupabase } from "@/lib/supabase";
import {
  CLIENT_SOURCES,
  CHANNELS,
  RELATIONSHIPS,
  labelFor,
  type Client,
  type Correspondence,
} from "@/lib/domain";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import Chip from "@/components/Chip";
import LogForm from "@/components/LogForm";
import Timeline from "@/components/Timeline";

export const metadata: Metadata = { title: "Client" };
export const dynamic = "force-dynamic";

type ProjectStub = { id: string; name: string; status: string };

async function loadClient(id: string, decisionsOnly: boolean) {
  const supabase = getSupabase();
  if (!supabase) return null;

  let log = supabase
    .from("studio_correspondence")
    .select("*")
    .eq("client_id", id)
    .order("occurred_at", { ascending: false })
    .limit(200);
  if (decisionsOnly) log = log.eq("is_decision", true);

  const [clientRes, logRes, projectsRes] = await Promise.all([
    supabase.from("studio_clients").select("*").eq("id", id).maybeSingle(),
    log,
    supabase
      .from("studio_projects")
      .select("id, name, status")
      .eq("client_id", id)
      .order("created_at", { ascending: false }),
  ]);

  if (!clientRes.data) return null;
  return {
    client: clientRes.data as Client,
    entries: (logRes.data ?? []) as Correspondence[],
    projects: (projectsRes.data ?? []) as ProjectStub[],
  };
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted">{label}</dt>
      <dd className="mt-1 break-words text-fluid-sm">{children}</dd>
    </div>
  );
}

export default async function ClientPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { filter?: string };
}) {
  const decisionsOnly = searchParams.filter === "decisions";
  const data = await loadClient(params.id, decisionsOnly);
  if (!data) notFound();
  const { client: c, entries, projects } = data;

  const arrival =
    labelFor(CLIENT_SOURCES, c.source) + (c.referred_by ? ` · ${c.referred_by}` : "");

  return (
    <div>
      <PageHeader
        kicker={c.archived_at ? "Client · Archived" : "Client"}
        title={c.name}
        sub={[c.company, c.location].filter(Boolean).join(" · ") || undefined}
      >
        <Link
          href={`/clients/${c.id}/edit`}
          className="inline-flex items-center rounded-full border border-line px-5 py-2.5 font-mono text-fluid-xs uppercase tracking-[0.18em] text-fg transition-colors duration-300 hover:border-fg"
        >
          Edit
        </Link>
      </PageHeader>

      <section aria-label="Details" className="border-b border-line px-6 py-6 md:px-10">
        <div className="flex flex-wrap items-center gap-2">
          {c.relationship !== "standard" && (
            <Chip filled>
              {labelFor(RELATIONSHIPS, c.relationship)}
              {c.default_discount_pct > 0 ? ` · ${Number(c.default_discount_pct)}% courtesy` : ""}
            </Chip>
          )}
          <Chip>{c.currency}</Chip>
          <Chip>{arrival}</Chip>
        </div>
        <dl className="mt-6 grid grid-cols-2 gap-x-8 gap-y-5 md:grid-cols-4">
          {c.email && (
            <Fact label="Email">
              <a href={`mailto:${c.email}`} className="underline decoration-line underline-offset-4 transition-colors hover:decoration-fg">
                {c.email}
              </a>
            </Fact>
          )}
          {c.phone && (
            <Fact label="Phone">
              <a href={`tel:${c.phone}`} className="underline decoration-line underline-offset-4 transition-colors hover:decoration-fg">
                {c.phone}
              </a>
            </Fact>
          )}
          {c.whatsapp && (
            <Fact label="WhatsApp">
              <a
                href={`https://wa.me/${c.whatsapp.replace(/[^\d]/g, "")}`}
                target="_blank"
                rel="noopener noreferrer"
                className="underline decoration-line underline-offset-4 transition-colors hover:decoration-fg"
              >
                {c.whatsapp}
              </a>
            </Fact>
          )}
          {c.preferred_channel && (
            <Fact label="Prefers">{labelFor(CHANNELS, c.preferred_channel)}</Fact>
          )}
          {c.decision_maker && <Fact label="Who decides">{c.decision_maker}</Fact>}
          {c.update_cadence && <Fact label="Update cadence">{c.update_cadence}</Fact>}
        </dl>
        {c.notes && (
          <p className="mt-6 max-w-[64ch] whitespace-pre-line text-fluid-sm leading-relaxed text-muted">
            {c.notes}
          </p>
        )}
      </section>

      <section aria-label="Projects" className="border-b border-line px-6 py-8 md:px-10">
        <p className="font-mono text-fluid-xs uppercase tracking-[0.18em] text-muted">Projects</p>
        <div className="mt-4">
          {projects.length === 0 ? (
            <EmptyState
              title="No projects on record."
              body="Project tracking lands in the next chunk; anything added then shows up here."
            />
          ) : (
            <ul className="divide-y divide-line border-y border-line">
              {projects.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-4 px-2 py-4">
                  <p className="truncate text-fluid-sm">{p.name}</p>
                  <Chip>{p.status.replace(/_/g, " ")}</Chip>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section aria-label="Correspondence" className="px-6 py-8 md:px-10">
        <div className="flex flex-wrap items-baseline justify-between gap-4">
          <p className="font-mono text-fluid-xs uppercase tracking-[0.18em] text-muted">
            Correspondence
          </p>
          <div className="flex gap-4 font-mono text-[10px] uppercase tracking-[0.18em]">
            <Link
              href={`/clients/${c.id}`}
              className={decisionsOnly ? "text-muted transition-colors hover:text-fg" : "text-fg"}
            >
              Everything
            </Link>
            <Link
              href={`/clients/${c.id}?filter=decisions`}
              className={decisionsOnly ? "text-fg" : "text-muted transition-colors hover:text-fg"}
            >
              Decisions only
            </Link>
          </div>
        </div>

        <div className="mt-5">
          <LogForm clientId={c.id} />
        </div>

        <div className="mt-8">
          {entries.length === 0 ? (
            <EmptyState
              title={decisionsOnly ? "No decisions flagged yet." : "Nothing logged yet."}
              body={
                decisionsOnly
                  ? "Flag entries that changed scope, price or timeline — they're the record that settles disputes."
                  : "Calls, texts, emails — write them down when they happen and this becomes the memory that wins arguments."
              }
            />
          ) : (
            <Timeline entries={entries} />
          )}
        </div>
      </section>
    </div>
  );
}
