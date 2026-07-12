import type { Metadata } from "next";
import { getSupabase } from "@/lib/supabase";
import { invoiceNumber } from "@/lib/invoice";
import type { PaymentDetail, PushDevice, Reminder } from "@/lib/domain";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import BillingSettingsForm from "@/components/BillingSettingsForm";
import NotificationSettings from "@/components/NotificationSettings";

export const metadata: Metadata = { title: "Settings" };
export const dynamic = "force-dynamic";

const logFmt = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Africa/Lagos",
});

export default async function SettingsPage() {
  const supabase = getSupabase();
  const [settings, devices, log] = supabase
    ? await Promise.all([
        supabase
          .from("studio_settings")
          .select(
            "base_currency, invoice_prefix, next_invoice_seq, payment_details, default_terms, default_tax_pct"
          )
          .eq("id", true)
          .single()
          .then((r) => r.data),
        supabase
          .from("studio_push_subscriptions")
          .select("id, endpoint, device_label, created_at, last_used_at")
          .order("created_at")
          .then((r) => (r.data ?? []) as PushDevice[]),
        supabase
          .from("studio_reminders")
          .select("id, due_at, kind, title, body, sent_at")
          .not("sent_at", "is", null)
          .order("sent_at", { ascending: false })
          .limit(6)
          .then((r) => (r.data ?? []) as Reminder[]),
      ])
    : [null, [] as PushDevice[], [] as Reminder[]];

  return (
    <div>
      <PageHeader
        kicker="Settings"
        title="How the studio runs"
        sub="Billing defaults, the payment details invoices carry, and the devices your reminders reach."
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

          <section aria-label="Notifications" className="border-b border-line px-6 py-8 md:px-10">
            <p className="font-mono text-fluid-xs uppercase tracking-[0.18em] text-muted">
              Notifications
            </p>
            <p className="mt-2 max-w-[52ch] text-fluid-sm leading-relaxed text-muted">
              Event reminders and the 8am digest go to every device below. On iPhone, install the
              app to the Home Screen first; Safari in a tab can&apos;t take push.
            </p>
            <div className="mt-6">
              <NotificationSettings devices={devices} />
            </div>

            {log.length > 0 && (
              <div className="mt-10">
                <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted">
                  Recently sent
                </p>
                <ul className="mt-3 divide-y divide-line border-y border-line">
                  {log.map((r) => (
                    <li key={r.id} className="flex items-baseline justify-between gap-4 px-2 py-3">
                      <p className="min-w-0 truncate text-fluid-sm">
                        {r.title}
                        {r.kind === "digest" && <span className="text-muted"> · digest</span>}
                      </p>
                      <p className="tnum shrink-0 font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
                        {r.sent_at ? logFmt.format(new Date(r.sent_at)) : ""}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            )}
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
