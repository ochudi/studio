import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getSupabase } from "@/lib/supabase";
import {
  INVOICE_STATUSES,
  labelFor,
  type Invoice,
  type InvoiceItem,
  type Payment,
} from "@/lib/domain";
import { formatMinor, BASE_CURRENCY } from "@/lib/money";
import { invoiceTotals, lineAmount, paidMinor, effectiveStatus } from "@/lib/invoice";
import PageHeader from "@/components/PageHeader";
import Chip from "@/components/Chip";
import InvoiceActions from "@/components/InvoiceActions";
import PaymentSection from "@/components/PaymentSection";

export const metadata: Metadata = { title: "Invoice" };
export const dynamic = "force-dynamic";

type Row = Invoice & {
  studio_clients: { id: string; name: string } | null;
  studio_projects: { id: string; name: string } | null;
};

async function loadInvoice(id: string) {
  const supabase = getSupabase();
  if (!supabase) return null;

  const [invRes, itemsRes, payRes] = await Promise.all([
    supabase
      .from("studio_invoices")
      .select("*, studio_clients(id, name), studio_projects(id, name)")
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("studio_invoice_items")
      .select("*")
      .eq("invoice_id", id)
      .order("sort_order", { ascending: true }),
    supabase
      .from("studio_payments")
      .select("*")
      .eq("invoice_id", id)
      .order("received_at", { ascending: true }),
  ]);

  if (!invRes.data) return null;
  return {
    invoice: invRes.data as Row,
    items: (itemsRes.data ?? []) as InvoiceItem[],
    payments: (payRes.data ?? []) as Payment[],
  };
}

const dateFmt = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "Africa/Lagos",
});
const fmtDay = (d: string) => dateFmt.format(new Date(d + "T12:00:00Z"));

function lagosToday(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Lagos" }).format(new Date());
}

const pct = (n: number) => Number(n).toLocaleString("en", { maximumFractionDigits: 2 });

function TotalRow({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-6">
      <dt className="min-w-0 font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
        {label}
      </dt>
      <dd className={`tnum whitespace-nowrap text-fluid-sm ${muted ? "text-muted" : ""}`}>{value}</dd>
    </div>
  );
}

export default async function InvoicePage({ params }: { params: { id: string } }) {
  const data = await loadInvoice(params.id);
  if (!data) notFound();
  const { invoice: inv, items, payments } = data;

  const totals = invoiceTotals(items, Number(inv.discount_pct), Number(inv.tax_pct));
  const paid = paidMinor(payments, inv.currency);
  const balance = Math.max(0, totals.total - paid);
  const status = effectiveStatus(inv, lagosToday(), balance);
  const money = (minor: number) => formatMinor(minor, inv.currency);
  const canRecord = ["sent", "partially_paid", "paid"].includes(inv.status);

  const dates: { label: string; value: string }[] = [
    { label: "Issued", value: fmtDay(inv.issue_date) },
    inv.due_date && { label: "Due", value: fmtDay(inv.due_date) },
    inv.paid_at && { label: "Paid", value: dateFmt.format(new Date(inv.paid_at)) },
    inv.voided_at && { label: "Voided", value: dateFmt.format(new Date(inv.voided_at)) },
  ].filter(Boolean) as { label: string; value: string }[];

  return (
    <div>
      <PageHeader
        kicker="Invoice"
        title={inv.number}
        sub={inv.studio_clients ? inv.studio_clients.name : undefined}
      >
        <InvoiceActions invoiceId={inv.id} status={inv.status} />
      </PageHeader>

      <section aria-label="Details" className="border-b border-line px-6 py-6 md:px-10">
        <div className="flex flex-wrap items-center gap-2">
          <Chip filled={status === "overdue"}>{labelFor(INVOICE_STATUSES, status)}</Chip>
          {inv.studio_clients && (
            <Link href={`/clients/${inv.studio_clients.id}`}>
              <Chip className="transition-colors hover:border-fg">{inv.studio_clients.name}</Chip>
            </Link>
          )}
          {inv.studio_projects && (
            <Link href={`/projects/${inv.studio_projects.id}`}>
              <Chip className="transition-colors hover:border-fg">{inv.studio_projects.name}</Chip>
            </Link>
          )}
          {dates.map((d) => (
            <Chip key={d.label}>
              {d.label} · {d.value}
            </Chip>
          ))}
        </div>
      </section>

      <section aria-label="Lines" className="border-b border-line px-6 py-8 md:px-10">
        <ul className="divide-y divide-line border-y border-line">
          {items.map((it) => (
            <li
              key={it.id}
              className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 py-4"
            >
              <div className="min-w-0">
                <p className="text-fluid-sm">{it.title}</p>
                {it.description && (
                  <p className="mt-0.5 max-w-[56ch] text-fluid-xs leading-relaxed text-muted">
                    {it.description}
                  </p>
                )}
                <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
                  {Number(it.quantity).toLocaleString("en", { maximumFractionDigits: 2 })} ×{" "}
                  {money(Number(it.unit_minor))}
                </p>
              </div>
              <p className="tnum text-fluid-sm">{money(lineAmount(it))}</p>
            </li>
          ))}
        </ul>

        <dl className="ml-auto mt-6 max-w-xs space-y-2.5">
          {(totals.discountMinor > 0 || totals.taxMinor > 0) && (
            <TotalRow label="Subtotal" value={money(totals.gross)} />
          )}
          {totals.discountMinor > 0 && (
            <TotalRow
              label={`${inv.discount_label ?? "Courtesy"}, less ${pct(inv.discount_pct)}%`}
              value={`−${money(totals.discountMinor)}`}
            />
          )}
          {totals.taxMinor > 0 && (
            <TotalRow label={`Tax · ${pct(inv.tax_pct)}%`} value={money(totals.taxMinor)} />
          )}
          {paid > 0 && (
            <>
              <TotalRow label="Total" value={money(totals.total)} />
              <TotalRow label="Paid to date" value={`−${money(paid)}`} muted />
            </>
          )}
          <div className="flex items-baseline justify-between gap-6 border-t border-fg pt-3">
            <dt className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
              {paid > 0 ? "Balance due" : "Total due"}
            </dt>
            <dd className="tnum font-display text-fluid-xl tracking-tightest">
              {paid > 0 && balance === 0 ? (
                <span className="text-muted">Settled</span>
              ) : (
                money(paid > 0 ? balance : totals.total)
              )}
            </dd>
          </div>
        </dl>

        {inv.fx_rate_to_base != null && inv.currency !== BASE_CURRENCY && (
          <p className="mt-6 text-right font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
            Frozen at 1 {inv.currency} = ₦
            {Number(inv.fx_rate_to_base).toLocaleString("en", { maximumFractionDigits: 2 })}
          </p>
        )}
      </section>

      <section aria-label="Payments" className="border-b border-line px-6 py-8 md:px-10">
        <p className="font-mono text-fluid-xs uppercase tracking-[0.18em] text-muted">Payments</p>
        <div className="mt-4">
          <PaymentSection
            invoiceId={inv.id}
            clientId={inv.client_id}
            currency={inv.currency}
            balanceMinor={balance}
            payments={payments}
            open={canRecord}
          />
        </div>
      </section>

      {(inv.notes || inv.terms) && (
        <section aria-label="Notes and terms" className="px-6 py-8 md:px-10">
          {inv.notes && (
            <div>
              <p className="font-mono text-fluid-xs uppercase tracking-[0.18em] text-muted">Notes</p>
              <p className="mt-2 max-w-[64ch] whitespace-pre-line text-fluid-sm leading-relaxed text-muted">
                {inv.notes}
              </p>
            </div>
          )}
          {inv.terms && (
            <div className={inv.notes ? "mt-6" : undefined}>
              <p className="font-mono text-fluid-xs uppercase tracking-[0.18em] text-muted">Terms</p>
              <p className="mt-2 max-w-[64ch] whitespace-pre-line text-fluid-sm leading-relaxed text-muted">
                {inv.terms}
              </p>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
