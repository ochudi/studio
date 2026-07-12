import type { Metadata } from "next";
import Link from "next/link";
import { getSupabase } from "@/lib/supabase";
import { DOC_KINDS, DOC_STATUSES, labelFor, type DocTemplate, type StudioDocument } from "@/lib/domain";
import { MASTERS } from "@/lib/doc-masters";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import Chip from "@/components/Chip";

export const metadata: Metadata = { title: "Documents" };
export const dynamic = "force-dynamic";

type DocRow = StudioDocument & {
  studio_clients: { name: string } | null;
  studio_projects: { name: string } | null;
};

async function loadDocuments() {
  const supabase = getSupabase();
  if (!supabase) return null;

  // First visit seeds the house masters; they're rows, so they're editable.
  const count = await supabase
    .from("studio_doc_templates")
    .select("id", { count: "exact", head: true });
  if ((count.count ?? 0) === 0) {
    await supabase
      .from("studio_doc_templates")
      .insert(MASTERS.map((m) => ({ ...m, is_default: true })));
  }

  const [docsRes, templatesRes] = await Promise.all([
    supabase
      .from("studio_documents")
      .select("*, studio_clients(name), studio_projects(name)")
      .not("kind", "in", "(receipt,invoice_pdf,signed_contract)")
      .order("created_at", { ascending: false }),
    supabase
      .from("studio_doc_templates")
      .select("id, kind, name, is_default")
      .order("created_at", { ascending: true }),
  ]);

  return {
    documents: (docsRes.data ?? []) as DocRow[],
    templates: (templatesRes.data ?? []) as DocTemplate[],
  };
}

const dayFmt = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  timeZone: "Africa/Lagos",
});

export default async function DocumentsPage() {
  const data = await loadDocuments();

  return (
    <div>
      <PageHeader
        kicker="Documents"
        title="The paper trail"
        sub="Proposals, contracts and packs from one block model: what you preview is what the PDF and the DOCX say. Sent versions freeze forever."
      >
        <Link
          href="/documents/new"
          className="inline-flex items-center rounded-full bg-fg px-5 py-2.5 font-mono text-fluid-xs uppercase tracking-[0.18em] text-bg transition-opacity duration-300 hover:opacity-85"
        >
          New document
        </Link>
      </PageHeader>

      <section aria-label="Documents" className="border-b border-line px-6 py-8 md:px-10">
        {!data ? (
          <EmptyState
            title="Supabase isn't connected."
            body="Wire up .env.local and run the migration, then the paper starts here."
          />
        ) : data.documents.length === 0 ? (
          <EmptyState
            title="Nothing drafted yet."
            body="Start from a master: the proposal, the contract and the onboarding pack already carry the house structure and voice."
          />
        ) : (
          <ul className="divide-y divide-line border-y border-line">
            {data.documents.map((d) => (
              <li key={d.id}>
                <Link
                  href={`/documents/${d.id}`}
                  className="grid grid-cols-1 gap-1 px-2 py-4 transition-colors hover:bg-raised sm:grid-cols-[1fr_auto] sm:items-center sm:gap-6"
                >
                  <div className="min-w-0">
                    <p className="truncate text-fluid-base">
                      {d.title}
                      {d.studio_clients?.name && (
                        <span className="text-muted"> · {d.studio_clients.name}</span>
                      )}
                    </p>
                    <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
                      {labelFor(DOC_KINDS, d.kind)}
                      {d.studio_projects?.name ? ` · ${d.studio_projects.name}` : ""}
                      {" · "}
                      {dayFmt.format(new Date(d.created_at))}
                    </p>
                  </div>
                  <div className="hidden items-center gap-2 sm:flex">
                    <Chip filled={d.status === "signed"}>{labelFor(DOC_STATUSES, d.status)}</Chip>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {data && data.templates.length > 0 && (
        <section aria-label="Templates" className="px-6 py-8 md:px-10">
          <p className="font-mono text-fluid-xs uppercase tracking-[0.18em] text-muted">
            Masters · edit once, every new document inherits
          </p>
          <ul className="mt-4 divide-y divide-line border-y border-line">
            {data.templates.map((t) => (
              <li key={t.id}>
                <Link
                  href={`/documents/templates/${t.id}/edit`}
                  className="flex items-baseline justify-between gap-6 px-2 py-3.5 transition-colors hover:bg-raised"
                >
                  <p className="text-fluid-sm">{t.name}</p>
                  <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
                    {labelFor(DOC_KINDS, t.kind)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
