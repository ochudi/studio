import type { Metadata } from "next";
import { getSupabase } from "@/lib/supabase";
import { invoiceNumber } from "@/lib/invoice";
import type { PaymentDetail } from "@/lib/domain";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import BillingSettingsForm from "@/components/BillingSettingsForm";

export const metadata: Metadata = { title: "Settings" };
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const supabase = getSupabase();
  const settings = supabase
    ? (
        await supabase
          .from("studio_settings")
          .select(
            "base_currency, invoice_prefix, next_invoice_seq, payment_details, default_terms, default_tax_pct"
          )
          .eq("id", true)
          .single()
      ).data
    : null;

  return (
    <div>
      <PageHeader
        kicker="Settings"
        title="How the studio runs"
        sub="Billing defaults and the payment details invoices carry. Notifications, quiet hours and push devices land with the calendar chunk."
      />

      {!settings ? (
        <div className="px-6 py-8 md:px-10">
          <EmptyState
            title="The database isn't ready."
            body="Run the migration in supabase/migrations, then this page reads the settings row."
          />
        </div>
      ) : (
        <>
          <section aria-label="Numbering" className="border-b border-line px-6 py-6 md:px-10">
            <div className="flex flex-wrap gap-x-12 gap-y-5">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted">
                  Base currency
                </p>
                <p className="mt-1 font-display text-fluid-xl tracking-tightest">
                  {settings.base_currency}
                </p>
              </div>
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted">
                  Next invoice
                </p>
                <p className="tnum mt-1 font-display text-fluid-xl tracking-tightest">
                  {invoiceNumber(settings.invoice_prefix, settings.next_invoice_seq)}
                </p>
              </div>
            </div>
          </section>

          <section aria-label="Billing" className="px-6 py-8 md:px-10">
            <BillingSettingsForm
              defaultTerms={settings.default_terms}
              defaultTaxPct={Number(settings.default_tax_pct)}
              paymentDetails={(settings.payment_details ?? {}) as Record<string, PaymentDetail>}
            />
          </section>
        </>
      )}
    </div>
  );
}
