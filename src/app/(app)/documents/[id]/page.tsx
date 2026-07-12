import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getSupabase } from "@/lib/supabase";
import { DOC_KINDS, DOC_STATUSES, labelFor, type StudioDocument } from "@/lib/domain";
import type { DocContent } from "@/lib/doc-blocks";
import PageHeader from "@/components/PageHeader";
import Chip from "@/components/Chip";
import DocRenderer from "@/components/DocRenderer";
import DocumentActions from "@/components/DocumentActions";

export const metadata: Metadata = { title: "Document" };
export const dynamic = "force-dynamic";

type Row = StudioDocument & {
  studio_clients: { id: string; name: string } | null;
  studio_projects: { id: string; name: string } | null;
};

const dateFmt = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "Africa/Lagos",
});

export default async function DocumentPage({ params }: { params: { id: string } }) {
  const supabase = getSupabase();
  if (!supabase) notFound();

  const [docRes, scanRes] = await Promise.all([
    supabase
      .from("studio_documents")
      .select("*, studio_clients(id, name), studio_projects(id, name)")
      .eq("id", params.id)
      .maybeSingle(),
    supabase
      .from("studio_documents")
      .select("id, created_at")
      .eq("kind", "signed_contract")
      .contains("content", { signed_of: params.id })
      .order("created_at", { ascending: false }),
  ]);

  const doc = docRes.data as Row | null;
  if (!doc || !doc.content) notFound();
  const scans = scanRes.data ?? [];

  const dates: { label: string; value: string }[] = [
    doc.sent_at && { label: "Sent", value: dateFmt.format(new Date(doc.sent_at)) },
    doc.signed_at && { label: "Signed", value: dateFmt.format(new Date(doc.signed_at)) },
  ].filter(Boolean) as { label: string; value: string }[];

  return (
    <div>
      <PageHeader
        kicker={`Document · ${labelFor(DOC_KINDS, doc.kind)}`}
        title={doc.title}
        sub={doc.studio_clients?.name ?? undefined}
      >
        <DocumentActions
          documentId={doc.id}
          status={doc.status}
          title={doc.title}
          clientId={doc.client_id}
          projectId={doc.project_id}
          kind={doc.kind}
        />
      </PageHeader>

      <section aria-label="Details" className="border-b border-line px-6 py-6 md:px-10">
        <div className="flex flex-wrap items-center gap-2">
          <Chip filled={doc.status === "signed"}>{labelFor(DOC_STATUSES, doc.status)}</Chip>
          {doc.studio_clients && (
            <Link href={`/clients/${doc.studio_clients.id}`}>
              <Chip className="transition-colors hover:border-fg">{doc.studio_clients.name}</Chip>
            </Link>
          )}
          {doc.studio_projects && (
            <Link href={`/projects/${doc.studio_projects.id}`}>
              <Chip className="transition-colors hover:border-fg">{doc.studio_projects.name}</Chip>
            </Link>
          )}
          {dates.map((d) => (
            <Chip key={d.label}>
              {d.label} · {d.value}
            </Chip>
          ))}
          {scans.map((scan, i) => (
            <a key={scan.id} href={`/api/receipts/${scan.id}`} target="_blank" rel="noreferrer">
              <Chip filled className="transition-opacity hover:opacity-85">
                Signed copy{scans.length > 1 ? ` · ${scans.length - i}` : ""}
              </Chip>
            </a>
          ))}
        </div>
        {doc.status === "draft" && (
          <p className="mt-4 max-w-[64ch] text-fluid-xs leading-relaxed text-muted">
            Still a draft. Marking it sent freezes this exact PDF as the record; revisions after
            that happen by duplicating.
          </p>
        )}
      </section>

      <section aria-label="Preview" className="px-6 py-10 md:px-10">
        <DocRenderer content={doc.content as DocContent} />
      </section>
    </div>
  );
}
