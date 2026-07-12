import type { Metadata } from "next";
import Link from "next/link";
import { getSupabase } from "@/lib/supabase";
import {
  INVOICE_STATUSES,
  PAYMENT_METHODS,
  OPEN_INVOICE_STATUSES,
  labelFor,
  type Invoice,
} from "@/lib/domain";
import { formatMinor } from "@/lib/money";
import { invoiceTotals, paidMinor, effectiveStatus } from "@/lib/invoice";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import Chip from "@/components/Chip";
import ExpenseSection, { type ExpenseRowData } from "@/components/ExpenseSection";

export const metadata: Metadata = { title: "Money" };
export const dynamic = "force-dynamic";

type InvoiceRow = Invoice & {
  studio_clients: { name: string } | null;
  studio_projects: { name: string } | null;
  studio_invoice_items: { quantity: number; unit_minor: number }[];
  studio_payments: { amount_minor: number; currency: string }[];
};

type PaymentRow = {
  id: string;
  amount_minor: number;
  currency: string;
  received_at: string;
  method: string;
  reference: string | null;
  invoice_id: string | null;
  studio_clients: { name: string } | null;
  studio_invoices: { number: string } | null;
};

function lagosToday(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Lagos" }).format(new Date());
}

async function loadMoney() {
  const supabase = getSupabase();
  if (!supabase) return null;

  const monthStart = lagosToday().slice(0, 7) + "-01";
  const [invoicesRes, recentRes, monthRes, expensesRes, monthSpendRes] = await Promise.all([
    supabase
      .from("studio_invoices")
      .select(
        "*, studio_clients(name), studio_projects(name), studio_invoice_items(quantity, unit_minor), studio_payments(amount_minor, currency)"
      )
      .order("created_at", { ascending: false }),
    supabase
      .from("studio_payments")
      .select(
        "id, amount_minor, currency, received_at, method, reference, invoice_id, studio_clients(name), studio_invoices(number)"
      )
      .order("received_at", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(8),
    supabase
      .from("studio_payments")
      .select("amount_minor, currency")
      .gte("received_at", monthStart),
    supabase
      .from("studio_expenses")
      .select("*, studio_projects(name)")
      .order("spent_at", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(8),
    supabase
      .from("studio_expenses")
      .select("amount_minor, currency")
      .gte("spent_at", monthStart),
  ]);

  return {
    invoices: (invoicesRes.data ?? []) as InvoiceRow[],
    recent: (recentRes.data ?? []) as unknown as PaymentRow[],
    month: monthRes.data ?? [],
    expenses: (expensesRes.data ?? []) as unknown as ExpenseRowData[],
    monthSpend: monthSpendRes.data ?? [],
  };
}

function sumByCurrency(entries: { currency: string; minor: number }[]): string {
  const map = new Map<string, number>();
  for (const e of entries) map.set(e.currency, (map.get(e.currency) ?? 0) + e.minor);
  return Array.from(map, ([currency, minor]) => formatMinor(minor, currency)).join(" · ");
}

const dayFmt = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  timeZone: "Africa/Lagos",
});
const fmtDay = (d: string) => dayFmt.format(new Date(d + "T12:00:00Z"));

function Tile({ label, value, quiet }: { label: string; value: string; quiet?: boolean }) {
  return (
    <div className="bg-bg px-6 py-6 md:px-10">
      <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted">{label}</p>
      <p
        className={`tnum mt-2 font-display text-fluid-2xl tracking-tightest ${quiet ? "text-muted" : ""}`}
      >
        {value}
      </p>
    </div>
  );
}

export default async function MoneyPage() {
  const data = await loadMoney();
  const today = lagosToday();
  const monthName = new Intl.DateTimeFormat("en-GB", {
    month: "long",
    timeZone: "Africa/Lagos",
  }).format(new Date());

  const rows = (data?.invoices ?? []).map((inv) => {
    const totals = invoiceTotals(
      inv.studio_invoice_items,
      Number(inv.discount_pct),
      Number(inv.tax_pct)
    );
    const paid = paidMinor(inv.studio_payments, inv.currency);
    const balance = Math.max(0, totals.total - paid);
    return { inv, totals, paid, balance, status: effectiveStatus(inv, today, balance) };
  });

  const open = rows.filter((r) => OPEN_INVOICE_STATUSES.includes(r.inv.status));
  const overdueCount = open.filter((r) => r.status === "overdue").length;
  const outstanding = sumByCurrency(
    open.map((r) => ({ currency: r.inv.currency, minor: r.balance }))
  );
  const received = sumByCurrency(
    (data?.month ?? []).map((p) => ({ currency: p.currency, minor: Number(p.amount_minor) }))
  );
  const spent = sumByCurrency(
    (data?.monthSpend ?? []).map((x) => ({ currency: x.currency, minor: Number(x.amount_minor) }))
  );

  return (
    <div>
      <PageHeader
        kicker="Money"
        title="The ledger"
        sub="Invoices at full value before any courtesy, payments as they land, expenses as they leave. The overview turns it into the picture."
      >
        <Link
          href="/money/overview"
          className="inline-flex items-center rounded-full border border-line px-5 py-2.5 font-mono text-fluid-xs uppercase tracking-[0.18em] text-fg transition-colors duration-300 hover:border-fg"
        >
          Overview
        </Link>
        <Link
          href="/money/payments/new"
          className="inline-flex items-center rounded-full border border-line px-5 py-2.5 font-mono text-fluid-xs uppercase tracking-[0.18em] text-fg transition-colors duration-300 hover:border-fg"
        >
          Record payment
        </Link>
        <Link
          href="/money/invoices/new"
          className="inline-flex items-center rounded-full bg-fg px-5 py-2.5 font-mono text-fluid-xs uppercase tracking-[0.18em] text-bg transition-opacity duration-300 hover:opacity-85"
        >
          New invoice
        </Link>
      </PageHeader>

      <section
        aria-label="Snapshot"
        className="grid grid-cols-1 gap-px border-b border-line bg-line sm:grid-cols-2 lg:grid-cols-4"
      >
        <Tile label="Outstanding" value={outstanding || "Nothing owed"} quiet={!outstanding} />
        <Tile
          label={`Received · ${monthName}`}
          value={received || "Nothing yet"}
          quiet={!received}
        />
        <Tile label={`Spent · ${monthName}`} value={spent || "Nothing"} quiet={!spent} />
        <Tile
          label="Open invoices"
          value={
            open.length === 0
              ? "None"
              : overdueCount > 0
                ? `${open.length} · ${overdueCount} overdue`
                : String(open.length)
          }
          quiet={open.length === 0}
        />
      </section>

      <section aria-label="Invoices" className="border-b border-line px-6 py-8 md:px-10">
        <p className="font-mono text-fluid-xs uppercase tracking-[0.18em] text-muted">Invoices</p>
        <div className="mt-4">
          {!data ? (
            <EmptyState
              title="Supabase isn't connected."
              body="Wire up .env.local and run the migration, then this page reads straight from the ledger."
            />
          ) : rows.length === 0 ? (
            <EmptyState
              title="No invoices yet."
              body="The first one takes a minute: pick the client, set the lines at full value, add a named courtesy if one applies."
            />
          ) : (
            <ul className="divide-y divide-line border-y border-line">
              {rows.map(({ inv, totals, balance, status }) => (
                <li key={inv.id}>
                  <Link
                    href={`/money/invoices/${inv.id}`}
                    className="grid grid-cols-1 gap-1 px-2 py-4 transition-colors hover:bg-raised sm:grid-cols-[1fr_auto] sm:items-center sm:gap-6"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-fluid-base">
                        <span className="font-mono text-fluid-sm tracking-tight">{inv.number}</span>
                        {inv.studio_clients?.name && (
                          <span className="text-muted"> · {inv.studio_clients.name}</span>
                        )}
                      </p>
                      <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
                        Issued {fmtDay(inv.issue_date)} · {formatMinor(totals.total, inv.currency)}
                        {inv.status === "partially_paid"
                          ? ` · ${formatMinor(balance, inv.currency)} open`
                          : ""}
                        {inv.due_date && OPEN_INVOICE_STATUSES.includes(inv.status)
                          ? ` · due ${fmtDay(inv.due_date)}`
                          : ""}
                      </p>
                    </div>
                    <div className="hidden items-center gap-2 sm:flex">
                      <Chip filled={status === "overdue"}>
                        {labelFor(INVOICE_STATUSES, status)}
                      </Chip>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section aria-label="Expenses" className="border-b border-line px-6 py-8 md:px-10">
        <div className="flex flex-wrap items-baseline justify-between gap-4">
          <p className="font-mono text-fluid-xs uppercase tracking-[0.18em] text-muted">
            Recent expenses
          </p>
          <Link
            href="/money/expenses/new"
            className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted transition-colors hover:text-fg"
          >
            + New expense
          </Link>
        </div>
        <div className="mt-4">
          <ExpenseSection
            expenses={data?.expenses ?? []}
            showProject
            emptyText="Nothing spent yet. Software, hosting, contractors, transport — capture it the moment it happens."
          />
        </div>
      </section>

      <section aria-label="Payments" className="px-6 py-8 md:px-10">
        <p className="font-mono text-fluid-xs uppercase tracking-[0.18em] text-muted">
          Recent payments
        </p>
        <div className="mt-4">
          {!data || data.recent.length === 0 ? (
            <EmptyState
              title="Nothing has landed yet."
              body="Payments recorded against invoices and money collected outside them both show up here."
            />
          ) : (
            <ul className="divide-y divide-line border-y border-line">
              {data.recent.map((p) => {
                const line = (
                  <>
                    <p className="tnum min-w-0 text-fluid-sm">
                      {formatMinor(Number(p.amount_minor), p.currency)}
                      {p.studio_clients?.name && (
                        <span className="text-muted"> · {p.studio_clients.name}</span>
                      )}
                    </p>
                    <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
                      {fmtDay(p.received_at)} · {labelFor(PAYMENT_METHODS, p.method)}
                      {p.studio_invoices?.number ? ` · ${p.studio_invoices.number}` : ""}
                    </p>
                  </>
                );
                return (
                  <li key={p.id}>
                    {p.invoice_id ? (
                      <Link
                        href={`/money/invoices/${p.invoice_id}`}
                        className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 px-2 py-3.5 transition-colors hover:bg-raised"
                      >
                        {line}
                      </Link>
                    ) : (
                      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 px-2 py-3.5">
                        {line}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
