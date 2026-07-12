import type { Metadata } from "next";
import { getSupabase } from "@/lib/supabase";
import { LIVE_STATUSES } from "@/lib/domain";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import DocumentNewForm, {
  type TemplateOption,
  type DocClientOption,
  type DocProjectOption,
} from "@/components/DocumentNewForm";

export const metadata: Metadata = { title: "New document" };
export const dynamic = "force-dynamic";

export default async function NewDocumentPage({
  searchParams,
}: {
  searchParams: { client?: string; project?: string };
}) {
  const supabase = getSupabase();
  if (!supabase) {
    return (
      <div>
        <PageHeader kicker="Documents" title="New document" />
        <div className="px-6 py-8 md:px-10">
          <EmptyState title="Supabase isn't connected." body="Wire up .env.local first." />
        </div>
      </div>
    );
  }

  const [templatesRes, clientsRes, projectsRes] = await Promise.all([
    supabase
      .from("studio_doc_templates")
      .select("id, kind, name")
      .order("created_at", { ascending: true }),
    supabase
      .from("studio_clients")
      .select("id, name, company")
      .is("archived_at", null)
      .order("name", { ascending: true }),
    supabase
      .from("studio_projects")
      .select("id, client_id, name")
      .in("status", LIVE_STATUSES)
      .order("created_at", { ascending: false }),
  ]);

  return (
    <div>
      <PageHeader
        kicker="Documents"
        title="New document"
        sub="Masters carry the structure and the voice; you fill in the specifics. It stays a draft until you freeze it."
      />
      <div className="px-6 py-8 md:px-10">
        <DocumentNewForm
          templates={(templatesRes.data ?? []) as TemplateOption[]}
          clients={(clientsRes.data ?? []).map(
            (c): DocClientOption => ({
              value: c.id,
              label: c.company ? `${c.name} · ${c.company}` : c.name,
            })
          )}
          projects={(projectsRes.data ?? []) as DocProjectOption[]}
          presetClient={searchParams.client}
          presetProject={searchParams.project}
        />
      </div>
    </div>
  );
}
