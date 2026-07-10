import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSupabase } from "@/lib/supabase";
import type { Client } from "@/lib/domain";
import PageHeader from "@/components/PageHeader";
import ClientForm from "@/components/ClientForm";
import ArchiveControl from "@/components/ArchiveControl";

export const metadata: Metadata = { title: "Edit client" };
export const dynamic = "force-dynamic";

export default async function EditClientPage({ params }: { params: { id: string } }) {
  const supabase = getSupabase();
  if (!supabase) notFound();

  const { data } = await supabase
    .from("studio_clients")
    .select("*")
    .eq("id", params.id)
    .maybeSingle();
  if (!data) notFound();
  const client = data as Client;

  return (
    <div>
      <PageHeader kicker="Clients" title={`Edit ${client.name}`} />
      <div className="px-6 py-8 md:px-10">
        <ClientForm client={client} />
        <div className="mt-14 border-t border-line pt-6">
          <ArchiveControl clientId={client.id} archived={!!client.archived_at} />
        </div>
      </div>
    </div>
  );
}
