import type { Metadata } from "next";
import { getSupabase } from "@/lib/supabase";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import ProjectForm from "@/components/ProjectForm";

export const metadata: Metadata = { title: "New project" };
export const dynamic = "force-dynamic";

export default async function NewProjectPage({
  searchParams,
}: {
  searchParams: { client?: string };
}) {
  const supabase = getSupabase();
  const { data } = supabase
    ? await supabase
        .from("studio_clients")
        .select("id, name, company")
        .is("archived_at", null)
        .order("name")
    : { data: null };

  const clients = (data ?? []).map((c) => ({
    value: c.id,
    label: c.company ? `${c.name} · ${c.company}` : c.name,
  }));

  return (
    <div>
      <PageHeader
        kicker="Projects"
        title="New project"
        sub="In-flight work backfills cleanly: set the real stage and note what's already been collected."
      />
      <div className="px-6 py-8 md:px-10">
        {clients.length === 0 ? (
          <EmptyState
            title="Add the client first."
            body="Projects hang off a client record — create the client, then come back here."
          />
        ) : (
          <ProjectForm clients={clients} presetClient={searchParams.client} />
        )}
      </div>
    </div>
  );
}
