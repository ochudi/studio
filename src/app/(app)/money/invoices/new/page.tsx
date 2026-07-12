import type { Metadata } from "next";
import { getSupabase } from "@/lib/supabase";
import { LIVE_STATUSES } from "@/lib/domain";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import InvoiceForm, { type ClientOption, type ProjectOption } from "@/components/InvoiceForm";

export const metadata: Metadata = { title: "New invoice" };
export const dynamic = "force-dynamic";

async function loadOptions() {
  const supabase = getSupabase();
  if (!supabase) return null;

  const [clientsRes, projectsRes, settingsRes] = await Promise.all([
    supabase
      .from("studio_clients")
      .select("id, name, company, currency, relationship, default_discount_pct")
      .is("archived_at", null)
      .order("name", { ascending: true }),
    supabase
      .from("studio_projects")
      .select("id, client_id, name")
      .in("status", LIVE_STATUSES)
      .order("created_at", { ascending: false }),
    supabase
      .from("studio_settings")
      .select("default_terms, default_tax_pct")
      .eq("id", true)
      .single(),
  ]);

  return {
    clients: (clientsRes.data ?? []).map(
      (c): ClientOption => ({
        value: c.id,
        label: c.company ? `${c.name} · ${c.company}` : c.name,
        currency: c.currency,
        relationship: c.relationship,
        default_discount_pct: Number(c.default_discount_pct),
      })
    ),
    projects: (projectsRes.data ?? []) as ProjectOption[],
    defaultTerms: settingsRes.data?.default_terms ?? null,
    defaultTaxPct: Number(settingsRes.data?.default_tax_pct ?? 0),
  };
}

export default async function NewInvoicePage({
  searchParams,
}: {
  searchParams: { client?: string; project?: string };
}) {
  const options = await loadOptions();

  return (
    <div>
      <PageHeader
        kicker="Money"
        title="New invoice"
        sub="Lines at full value, one named courtesy if any, and the total the client actually pays. It starts as a draft."
      />
      <div className="px-6 py-8 md:px-10">
        {!options ? (
          <EmptyState
            title="Supabase isn't connected."
            body="Wire up .env.local first — the invoice needs somewhere to live."
          />
        ) : options.clients.length === 0 ? (
          <EmptyState
            title="Add the client first."
            body="Invoices hang off a client record. Once they exist, billing them takes a minute."
          />
        ) : (
          <InvoiceForm
            clients={options.clients}
            projects={options.projects}
            presetClient={searchParams.client}
            presetProject={searchParams.project}
            defaultTerms={options.defaultTerms}
            defaultTaxPct={options.defaultTaxPct}
          />
        )}
      </div>
    </div>
  );
}
