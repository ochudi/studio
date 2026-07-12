import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSupabase } from "@/lib/supabase";
import type { Project } from "@/lib/domain";
import PageHeader from "@/components/PageHeader";
import ProjectForm from "@/components/ProjectForm";

export const metadata: Metadata = { title: "Edit project" };
export const dynamic = "force-dynamic";

export default async function EditProjectPage({ params }: { params: { id: string } }) {
  const supabase = getSupabase();
  if (!supabase) notFound();

  const [{ data: project }, { data: clientRows }] = await Promise.all([
    supabase.from("studio_projects").select("*").eq("id", params.id).maybeSingle(),
    supabase.from("studio_clients").select("id, name, company").order("name"),
  ]);
  if (!project) notFound();

  const clients = (clientRows ?? []).map((c) => ({
    value: c.id,
    label: c.company ? `${c.name} · ${c.company}` : c.name,
  }));

  return (
    <div>
      <PageHeader kicker="Projects" title={`Edit ${project.name}`} />
      <div className="px-6 py-8 md:px-10">
        <ProjectForm project={project as Project} clients={clients} />
      </div>
    </div>
  );
}
