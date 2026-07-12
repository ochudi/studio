import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getSupabase } from "@/lib/supabase";
import { LIVE_STATUSES, type Invoice, type InvoiceItem } from "@/lib/domain";
import PageHeader from "@/components/PageHeader";
import InvoiceForm, { type ClientOption, type ProjectOption } from "@/components/InvoiceForm";

export const metadata: Metadata = { title: "Edit invoice" };
export const dynamic = "force-dynamic";

export default async function EditInvoicePage({ params }: { params: { id: string } }) {
  const supabase = getSupabase();
  if (!supabase) notFound();

  const [invRes, itemsRes, clientsRes, projectsRes, settingsRes] = await Promise.all([
    supabase.from("studio_invoices").select("*").eq("id", params.id).maybeSingle(),
    supabase
      .from("studio_invoice_items")
      .select("*")
      .eq("invoice_id", params.id)
      .order("sort_order", { ascending: true }),
    supabase
      .from("studio_clients")
      .select("id, name, company, currency, relationship, default_discount_pct")
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

  const invoice = invRes.data as Invoice | null;
  if (!invoice) notFound();
  // A sent invoice is the record; the lifecycle buttons are its only levers.
  if (invoice.status !== "draft") redirect(`/money/invoices/${invoice.id}`);

  const clients = (clientsRes.data ?? []).map(
    (c): ClientOption => ({
      value: c.id,
      label: c.company ? `${c.name} · ${c.company}` : c.name,
      currency: c.currency,
      relationship: c.relationship,
      default_discount_pct: Number(c.default_discount_pct),
    })
  );

  return (
    <div>
      <PageHeader kicker="Money" title={`Edit ${invoice.number}`} sub="Still a draft, still yours to shape." />
      <div className="px-6 py-8 md:px-10">
        <InvoiceForm
          invoice={invoice}
          items={(itemsRes.data ?? []) as InvoiceItem[]}
          clients={clients}
          projects={(projectsRes.data ?? []) as ProjectOption[]}
          defaultTerms={settingsRes.data?.default_terms ?? null}
          defaultTaxPct={Number(settingsRes.data?.default_tax_pct ?? 0)}
        />
      </div>
    </div>
  );
}
