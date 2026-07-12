import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getSupabase } from "@/lib/supabase";
import PageHeader from "@/components/PageHeader";
import EventForm from "@/components/EventForm";

export const metadata: Metadata = { title: "Edit event" };
export const dynamic = "force-dynamic";

export default async function EditEventPage({ params }: { params: { id: string } }) {
  const supabase = getSupabase();
  if (!supabase) notFound();

  const event = (
    await supabase.from("studio_events").select("*").eq("id", params.id).maybeSingle()
  ).data;
  if (!event) notFound();
  if (event.status !== "scheduled") redirect(`/calendar/${event.id}`);

  // Unfiltered on purpose: an event pinned to an archived client or a closed
  // project must still render its current selection in the form.
  const [clients, projects] = await Promise.all([
    supabase.from("studio_clients").select("id, name").order("name"),
    supabase.from("studio_projects").select("id, name, client_id").order("name"),
  ]);

  return (
    <div>
      <PageHeader
        kicker="Calendar"
        title="Editing"
        sub="Moving it re-arms the reminders, and re-sending the invite updates the client's calendar instead of duplicating it."
      />
      <div className="px-6 py-8 md:px-10">
        <EventForm clients={clients.data ?? []} projects={projects.data ?? []} initial={event} />
      </div>
    </div>
  );
}
