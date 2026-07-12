import type { Metadata } from "next";
import { getSupabase } from "@/lib/supabase";
import { LIVE_STATUSES } from "@/lib/domain";
import PageHeader from "@/components/PageHeader";
import EventForm from "@/components/EventForm";

export const metadata: Metadata = { title: "New event" };
export const dynamic = "force-dynamic";

export default async function NewEventPage({
  searchParams,
}: {
  searchParams: { client?: string; project?: string };
}) {
  const supabase = getSupabase();
  const [clients, projects] = supabase
    ? await Promise.all([
        supabase.from("studio_clients").select("id, name").is("archived_at", null).order("name"),
        supabase.from("studio_projects").select("id, name, client_id").in("status", LIVE_STATUSES).order("name"),
      ])
    : [{ data: [] }, { data: [] }];

  return (
    <div>
      <PageHeader
        kicker="Calendar"
        title="New event"
        sub="Reminders land on your devices before it starts; the invite reaches the client only when you send it."
      />
      <div className="px-6 py-8 md:px-10">
        <EventForm
          clients={clients.data ?? []}
          projects={projects.data ?? []}
          defaultClientId={searchParams.client}
          defaultProjectId={searchParams.project}
        />
      </div>
    </div>
  );
}
