import type { Metadata } from "next";
import Link from "next/link";
import { getSupabase } from "@/lib/supabase";
import { EXPENSE_CATEGORIES, labelFor } from "@/lib/domain";
import { formatMinor, BASE_CURRENCY } from "@/lib/money";
import { invoiceTotals } from "@/lib/invoice";
import { rateToBase } from "@/lib/fx";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";

export const metadata: Metadata = { title: "Overview" };
export const dynamic = "force-dynamic";

/**
 * The picture: everything converted to naira at the rate frozen when the
 * money moved. Rows that predate FX snapshots fall back to the latest
 * cached rate, so old backfilled payments still count honestly rather
 * than at face value.
 */

type MoneyRow = { amount_minor: number; currency: string; fx_rate_to_base: number | null };

function lagosToday(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Lagos" }).format(new Date());
}

const monthLabel = (ym: string) =>
  new Intl.DateTimeFormat("en-GB", { month: "short" }).format(new Date(ym + "-15T12:00:00Z")) +
  " " +
  ym.slice(2, 4);

async function loadPicture() {
  const supabase = getSupabase();
  if (!supabase) return null;

  const [paymentsRes, expensesRes, invoicesRes, projectsRes] = await Promise.all([
    supabase
      .from("studio_payments")
      .select("amount_minor, currency, fx_rate_to_base, received_at, project_id"),
    supabase
      .from("studio_expenses")
      .select("amount_minor, currency, fx_rate_to_base, spent_at, category, project_id"),
    supabase
      .from("studio_invoices")
      .select(
        "currency, fx_rate_to_base, issue_date, discount_pct, tax_pct, status, studio_invoice_items(quantity, unit_minor), studio_clients(relationship)"
      )
      .not("status", "in", "(draft,void)"),
    supabase.from("studio_projects").select("id, name, studio_clients(name)"),
  ]);

  const payments = paymentsRes.data ?? [];
  const expenses = expensesRes.data ?? [];
  const invoices = invoicesRes.data ?? [];
  const projects = projectsRes.data ?? [];

  // Fallback rates for rows recorded before snapshots existed.
  const missing = new Set<string>();
  for (const r of [...payments, ...expenses, ...invoices] as MoneyRow[]) {
    if (r.fx_rate_to_base == null && r.currency !== BASE_CURRENCY) missing.add(r.currency);
  }
  const fallback = new Map<string, number>();
  for (const c of Array.from(missing)) {
    const rate = await rateToBase(supabase, c);
    if (rate) fallback.set(c, rate);
  }

  const toBase = (minor: number, currency: string, fx: number | null) => {
    if (currency === BASE_CURRENCY) return Number(minor);
    const rate = fx ?? fallback.get(currency);
    return rate ? Math.round(Number(minor) * Number(rate)) : Number(minor);
  };

  return { payments, expenses, invoices, projects, toBase };
}

function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-bg px-6 py-6 md:px-10">
      <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted">{label}</p>
      <p className="tnum mt-2 font-display text-fluid-2xl tracking-tightest">{value}</p>
      {sub && (
        <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.16em] text-muted">{sub}</p>
      )}
    </div>
  );
}

function Bar({ minor, max, muted }: { minor: number; max: number; muted?: boolean }) {
  const width = max > 0 ? Math.max(minor > 0 ? 1.5 : 0, (minor / max) * 100) : 0;
  return (
    <div className="h-[5px] w-full">
      <div
        className={muted ? "h-full bg-fg/25" : "h-full bg-fg"}
        style={{ width: `${width}%` }}
      />
    </div>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-mono text-fluid-xs uppercase tracking-[0.18em] text-muted">{children}</p>
  );
}

export default async function OverviewPage() {
  const data = await loadPicture();
  const today = lagosToday();
  const year = today.slice(0, 4);
  const fmt = (minor: number) => formatMinor(minor, BASE_CURRENCY);

  if (!data) {
    return (
      <div>
        <PageHeader kicker="Money" title="The picture" />
        <div className="px-6 py-8 md:px-10">
          <EmptyState
            title="Supabase isn't connected."
            body="Wire up .env.local and run the migration, then the numbers draw themselves."
          />
        </div>
      </div>
    );
  }

  const { payments, expenses, invoices, projects, toBase } = data;

  // Year-to-date headline numbers, all in base.
  const cashInYtd = payments
    .filter((p) => p.received_at >= `${year}-01-01`)
    .reduce((s, p) => s + toBase(p.amount_minor, p.currency, p.fx_rate_to_base), 0);
  const spentYtd = expenses
    .filter((x) => x.spent_at >= `${year}-01-01`)
    .reduce((s, x) => s + toBase(x.amount_minor, x.currency, x.fx_rate_to_base), 0);

  let trueValueYtd = 0;
  let courtesyYtd = 0;
  let proBonoYtd = 0;
  for (const inv of invoices) {
    if (inv.issue_date < `${year}-01-01`) continue;
    const totals = invoiceTotals(
      inv.studio_invoice_items ?? [],
      Number(inv.discount_pct),
      Number(inv.tax_pct)
    );
    trueValueYtd += toBase(totals.gross, inv.currency, inv.fx_rate_to_base);
    const courtesy = toBase(totals.discountMinor, inv.currency, inv.fx_rate_to_base);
    courtesyYtd += courtesy;
    const relationship = (inv.studio_clients as { relationship?: string } | null)?.relationship;
    if (relationship === "pro_bono") proBonoYtd += courtesy;
  }

  // Cash by month, last 12 including this one.
  const months: string[] = [];
  {
    const [y, m] = today.split("-").map(Number);
    for (let i = 11; i >= 0; i--) {
      const d = new Date(Date.UTC(y, m - 1 - i, 15));
      months.push(d.toISOString().slice(0, 7));
    }
  }
  const inByMonth = new Map<string, number>();
  const outByMonth = new Map<string, number>();
  for (const p of payments) {
    const ym = p.received_at.slice(0, 7);
    inByMonth.set(ym, (inByMonth.get(ym) ?? 0) + toBase(p.amount_minor, p.currency, p.fx_rate_to_base));
  }
  for (const x of expenses) {
    const ym = x.spent_at.slice(0, 7);
    outByMonth.set(ym, (outByMonth.get(ym) ?? 0) + toBase(x.amount_minor, x.currency, x.fx_rate_to_base));
  }
  const allMonthRows = months.map((ym) => ({
    ym,
    inMinor: inByMonth.get(ym) ?? 0,
    outMinor: outByMonth.get(ym) ?? 0,
  }));
  // Months before the studio's first movement are silence, not history —
  // trim them, but keep at least half a year of shape.
  const firstActive = allMonthRows.findIndex((r) => r.inMinor > 0 || r.outMinor > 0);
  const monthRows = allMonthRows.slice(
    firstActive === -1 ? -6 : Math.min(firstActive, allMonthRows.length - 6)
  );
  const monthMax = Math.max(1, ...monthRows.flatMap((r) => [r.inMinor, r.outMinor]));
  const hasCash = monthRows.some((r) => r.inMinor > 0 || r.outMinor > 0);

  // Where it goes: categories, year to date.
  const byCategory = new Map<string, number>();
  for (const x of expenses) {
    if (x.spent_at < `${year}-01-01`) continue;
    byCategory.set(
      x.category,
      (byCategory.get(x.category) ?? 0) + toBase(x.amount_minor, x.currency, x.fx_rate_to_base)
    );
  }
  const categories = Array.from(byCategory, ([category, minor]) => ({ category, minor })).sort(
    (a, b) => b.minor - a.minor
  );
  const categoryMax = Math.max(1, ...categories.map((c) => c.minor));

  // Profitability per project: revenue minus direct costs, ranked.
  const revenue = new Map<string, number>();
  const costs = new Map<string, number>();
  for (const p of payments) {
    if (!p.project_id) continue;
    revenue.set(
      p.project_id,
      (revenue.get(p.project_id) ?? 0) + toBase(p.amount_minor, p.currency, p.fx_rate_to_base)
    );
  }
  for (const x of expenses) {
    if (!x.project_id) continue;
    costs.set(
      x.project_id,
      (costs.get(x.project_id) ?? 0) + toBase(x.amount_minor, x.currency, x.fx_rate_to_base)
    );
  }
  const ranked = projects
    .map((p) => {
      const rev = revenue.get(p.id) ?? 0;
      const cost = costs.get(p.id) ?? 0;
      return {
        id: p.id,
        name: p.name,
        client: (p.studio_clients as { name?: string } | null)?.name ?? null,
        rev,
        cost,
        profit: rev - cost,
        margin: rev > 0 ? Math.round(((rev - cost) / rev) * 100) : null,
      };
    })
    .filter((p) => p.rev > 0 || p.cost > 0)
    .sort((a, b) => b.profit - a.profit);

  return (
    <div>
      <PageHeader
        kicker="Money"
        title="The picture"
        sub="Everything in naira, converted at the rate frozen when the money moved. Anything recorded before rates existed counts at the latest one."
      />

      <section
        aria-label="Year to date"
        className="grid grid-cols-1 gap-px border-b border-line bg-line sm:grid-cols-2 lg:grid-cols-4"
      >
        <Tile label={`Cash in · ${year}`} value={fmt(cashInYtd)} />
        <Tile label={`Spent · ${year}`} value={fmt(spentYtd)} />
        <Tile
          label={`True value · ${year}`}
          value={fmt(trueValueYtd)}
          sub={courtesyYtd > 0 ? `courtesy given ${fmt(courtesyYtd)}` : "invoiced at full worth"}
        />
        <Tile
          label={`Pro bono · ${year}`}
          value={proBonoYtd > 0 ? fmt(proBonoYtd) : "—"}
          sub={proBonoYtd > 0 ? "given, on the record" : undefined}
        />
      </section>

      <section aria-label="Cash by month" className="border-b border-line px-6 py-8 md:px-10">
        <SectionHeading>Cash by month · in solid, out faint</SectionHeading>
        <div className="mt-5">
          {!hasCash ? (
            <EmptyState
              title="No movements yet."
              body="Payments and expenses draw this chart on their own; nothing to configure."
            />
          ) : (
            <ul className="space-y-4">
              {monthRows.map((r) => (
                <li key={r.ym} className="grid grid-cols-[3.5rem_1fr] items-center gap-x-5 sm:grid-cols-[3.5rem_1fr_14rem]">
                  <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
                    {monthLabel(r.ym)}
                  </p>
                  <div className="space-y-1">
                    <Bar minor={r.inMinor} max={monthMax} />
                    <Bar minor={r.outMinor} max={monthMax} muted />
                  </div>
                  <p className="col-start-2 mt-1 font-mono text-[10px] uppercase tracking-[0.16em] text-muted sm:col-start-3 sm:mt-0 sm:text-right">
                    {r.inMinor > 0 ? `in ${fmt(r.inMinor)}` : ""}
                    {r.inMinor > 0 && r.outMinor > 0 ? " · " : ""}
                    {r.outMinor > 0 ? `out ${fmt(r.outMinor)}` : ""}
                    {r.inMinor === 0 && r.outMinor === 0 ? "—" : ""}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {categories.length > 0 && (
        <section aria-label="Where it goes" className="border-b border-line px-6 py-8 md:px-10">
          <SectionHeading>Where it goes · {year}</SectionHeading>
          <ul className="mt-5 space-y-4">
            {categories.map((c) => (
              <li key={c.category} className="grid grid-cols-[8rem_1fr_auto] items-center gap-x-5">
                <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
                  {labelFor(EXPENSE_CATEGORIES, c.category)}
                </p>
                <Bar minor={c.minor} max={categoryMax} />
                <p className="tnum text-fluid-xs">{fmt(c.minor)}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-label="Profitability" className="px-6 py-8 md:px-10">
        <SectionHeading>Projects, ranked by what they keep</SectionHeading>
        <div className="mt-4">
          {ranked.length === 0 ? (
            <EmptyState
              title="No project money yet."
              body="Once payments and expenses carry a project tag, this ranks every engagement by what it actually kept."
            />
          ) : (
            <ul className="divide-y divide-line border-y border-line">
              {ranked.map((p) => (
                <li key={p.id}>
                  <Link
                    href={`/projects/${p.id}`}
                    className="grid grid-cols-1 gap-1 px-2 py-4 transition-colors hover:bg-raised sm:grid-cols-[1fr_auto] sm:items-center sm:gap-6"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-fluid-base">
                        {p.name}
                        {p.client && <span className="text-muted"> · {p.client}</span>}
                      </p>
                      <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
                        in {fmt(p.rev)} · out {fmt(p.cost)}
                        {p.margin !== null ? ` · keeps ${p.margin}%` : ""}
                      </p>
                    </div>
                    <p
                      className={`tnum whitespace-nowrap font-display text-fluid-xl tracking-tightest ${
                        p.profit < 0 ? "text-muted" : ""
                      }`}
                    >
                      {p.profit < 0 ? `−${fmt(Math.abs(p.profit))}` : fmt(p.profit)}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
