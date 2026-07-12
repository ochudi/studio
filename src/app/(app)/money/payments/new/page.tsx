import type { Metadata } from "next";
import { getSupabase } from "@/lib/supabase";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import StandalonePaymentForm, {
  type PayClientOption,
  type PayProjectOption,
} from "@/components/StandalonePaymentForm";

export const metadata: Metadata = { title: "Record payment" };
export const dynamic = "force-dynamic";

export default async function NewPaymentPage({
  searchParams,
}: {
  searchParams: { client?: string; project?: string };
}) {
  const supabase = getSupabase();

  const [clientsRes, projectsRes] = supabase
    ? await Promise.all([
        supabase
          .from("studio_clients")
          .select("id, name, company, currency")
          .is("archived_at", null)
          .order("name", { ascending: true }),
        supabase
          .from("studio_projects")
          .select("id, client_id, name")
          .order("created_at", { ascending: false }),
      ])
    : [null, null];

  const clients = (clientsRes?.data ?? []).map(
    (c): PayClientOption => ({
      value: c.id,
      label: c.company ? `${c.name} · ${c.company}` : c.name,
      currency: c.currency,
    })
  );

  return (
    <div>
      <PageHeader
        kicker="Money"
        title="Record a payment"
        sub="For money that lands without an invoice. Payments against an invoice are recorded on the invoice itself."
      />
      <div className="px-6 py-8 md:px-10">
        {clients.length === 0 ? (
          <EmptyState
            title="Add the client first."
            body="Every payment belongs to someone. Once the client exists, this takes seconds."
          />
        ) : (
          <StandalonePaymentForm
            clients={clients}
            projects={(projectsRes?.data ?? []) as PayProjectOption[]}
            presetClient={searchParams.client}
            presetProject={searchParams.project}
          />
        )}
      </div>
    </div>
  );
}
