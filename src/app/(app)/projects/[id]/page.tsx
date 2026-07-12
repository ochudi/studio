import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getSupabase } from "@/lib/supabase";
import {
  PROJECT_KINDS,
  PRICING_MODELS,
  INVOICE_STATUSES,
  labelFor,
  type Project,
  type Milestone,
  type ChangeRequest,
  type HandoverItem,
  type Correspondence,
} from "@/lib/domain";
import { formatMinor } from "@/lib/money";
import { invoiceTotals, paidMinor, effectiveStatus } from "@/lib/invoice";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import Chip from "@/components/Chip";
import StatusControl from "@/components/StatusControl";
import MilestoneSection from "@/components/MilestoneSection";
import ChangeRequestSection from "@/components/ChangeRequestSection";
import HandoverSection from "@/components/HandoverSection";
import LogForm from "@/components/LogForm";
import Timeline from "@/components/Timeline";

export const metadata: Metadata = { title: "Project" };
export const dynamic = "force-dynamic";

type ProjectRow = Project & { studio_clients: { id: string; name: string } | null };
type Payment = { amount_minor: number; currency: string; received_at: string };
type InvoiceRow = {
  id: string;
  number: string;
  status: string;
  currency: string;
  issue_date: string;
  due_date: string | null;
  discount_pct: number;
  tax_pct: number;
  studio_invoice_items: { quantity: number; unit_minor: number }[];
  studio_payments: { amount_minor: number; currency: string }[];
};

async function loadProject(id: string) {
  const supabase = getSupabase();
  if (!supabase) return null;

  const [projectRes, milestonesRes, paymentsRes, crRes, handoverRes, logRes, invoicesRes] =
    await Promise.all([
      supabase
        .from("studio_projects")
        .select("*, studio_clients(id, name)")
        .eq("id", id)
        .maybeSingle(),
      supabase
        .from("studio_milestones")
        .select("*")
        .eq("project_id", id)
        .order("due_date", { ascending: true, nullsFirst: false })
        .order("sort_order", { ascending: true }),
      supabase
        .from("studio_payments")
        .select("amount_minor, currency, received_at")
        .eq("project_id", id),
      supabase
        .from("studio_change_requests")
        .select("*")
        .eq("project_id", id)
        .order("created_at", { ascending: false }),
      supabase
        .from("studio_handover_items")
        .select("*")
        .eq("project_id", id)
        .order("created_at", { ascending: true }),
      supabase
        .from("studio_correspondence")
        .select("*")
        .eq("project_id", id)
        .order("occurred_at", { ascending: false })
        .limit(100),
      supabase
        .from("studio_invoices")
        .select(
          "id, number, status, currency, issue_date, due_date, discount_pct, tax_pct, studio_invoice_items(quantity, unit_minor), studio_payments(amount_minor, currency)"
        )
        .eq("project_id", id)
        .order("created_at", { ascending: false }),
    ]);

  if (!projectRes.data) return null;
  return {
    project: projectRes.data as ProjectRow,
    milestones: (milestonesRes.data ?? []) as Milestone[],
    payments: (paymentsRes.data ?? []) as Payment[],
    changeRequests: (crRes.data ?? []) as ChangeRequest[],
    handover: (handoverRes.data ?? []) as HandoverItem[],
    entries: (logRes.data ?? []) as Correspondence[],
    invoices: (invoicesRes.data ?? []) as InvoiceRow[],
  };
}

function lagosToday(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Lagos" }).format(new Date());
}

const dateFmt = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "Africa/Lagos",
});

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-mono text-fluid-xs uppercase tracking-[0.18em] text-muted">{children}</p>
  );
}

export default async function ProjectPage({ params }: { params: { id: string } }) {
  const data = await loadProject(params.id);
  if (!data) notFound();
  const { project: p, milestones, payments, changeRequests, handover, entries, invoices } = data;
  const today = lagosToday();

  // Money in the project's own currency; cross-currency payments are rare
  // enough to list rather than convert until the FX overview lands.
  const collected = payments
    .filter((pay) => pay.currency === p.currency)
    .reduce((sum, pay) => sum + Number(pay.amount_minor), 0);
  const foreign = payments.filter((pay) => pay.currency !== p.currency);
  const remaining = p.quoted_minor ? Math.max(0, p.quoted_minor - collected) : null;

  const dates: { label: string; value: string }[] = [
    p.start_date && { label: "Started", value: dateFmt.format(new Date(p.start_date + "T12:00:00Z")) },
    p.due_date && { label: "Due", value: dateFmt.format(new Date(p.due_date + "T12:00:00Z")) },
    p.delivered_at && { label: "Delivered", value: dateFmt.format(new Date(p.delivered_at)) },
    p.closed_at && { label: p.status === "lost" ? "Lost" : "Closed", value: dateFmt.format(new Date(p.closed_at)) },
  ].filter(Boolean) as { label: string; value: string }[];

  return (
    <div>
      <PageHeader kicker="Project" title={p.name} sub={p.description ?? undefined}>
        <div className="flex items-center gap-3">
          <StatusControl projectId={p.id} status={p.status} />
          <Link
            href={`/projects/${p.id}/edit`}
            className="inline-flex items-center rounded-full border border-line px-5 py-2.5 font-mono text-fluid-xs uppercase tracking-[0.18em] text-fg transition-colors duration-300 hover:border-fg"
          >
            Edit
          </Link>
        </div>
      </PageHeader>

      <section aria-label="Details" className="border-b border-line px-6 py-6 md:px-10">
        <div className="flex flex-wrap items-center gap-2">
          {p.studio_clients && (
            <Link href={`/clients/${p.studio_clients.id}`}>
              <Chip className="transition-colors hover:border-fg">{p.studio_clients.name}</Chip>
            </Link>
          )}
          <Chip>{labelFor(PROJECT_KINDS, p.kind)}</Chip>
          <Chip>{labelFor(PRICING_MODELS, p.pricing_model)}</Chip>
          {dates.map((d) => (
            <Chip key={d.label}>
              {d.label} · {d.value}
            </Chip>
          ))}
        </div>

        <dl className="mt-6 grid grid-cols-3 gap-x-8 gap-y-5">
          <div>
            <dt className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted">Quoted</dt>
            <dd className="tnum mt-1 font-display text-fluid-xl tracking-tightest">
              {p.quoted_minor ? formatMinor(p.quoted_minor, p.currency) : "—"}
            </dd>
          </div>
          <div>
            <dt className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted">Collected</dt>
            <dd className="tnum mt-1 font-display text-fluid-xl tracking-tightest">
              {collected > 0 ? formatMinor(collected, p.currency) : "—"}
              {foreign.map((f, i) => (
                <span key={i} className="text-muted"> + {formatMinor(Number(f.amount_minor), f.currency)}</span>
              ))}
            </dd>
          </div>
          <div>
            <dt className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted">Remaining</dt>
            <dd className="tnum mt-1 font-display text-fluid-xl tracking-tightest">
              {remaining === null ? "—" : remaining === 0 ? (
                <span className="text-muted">Settled</span>
              ) : (
                formatMinor(remaining, p.currency)
              )}
            </dd>
          </div>
        </dl>

        {p.notes && (
          <p className="mt-6 max-w-[64ch] whitespace-pre-line text-fluid-sm leading-relaxed text-muted">
            {p.notes}
          </p>
        )}
      </section>

      <section aria-label="Invoices" className="border-b border-line px-6 py-8 md:px-10">
        <div className="flex flex-wrap items-baseline justify-between gap-4">
          <SectionHeading>Invoices</SectionHeading>
          <Link
            href={`/money/invoices/new?client=${p.client_id}&project=${p.id}`}
            className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted transition-colors hover:text-fg"
          >
            + New invoice
          </Link>
        </div>
        <div className="mt-4">
          {invoices.length === 0 ? (
            <p className="text-fluid-xs text-muted">Nothing billed against this project yet.</p>
          ) : (
            <ul className="divide-y divide-line border-y border-line">
              {invoices.map((inv) => {
                const totals = invoiceTotals(
                  inv.studio_invoice_items,
                  Number(inv.discount_pct),
                  Number(inv.tax_pct)
                );
                const balance = Math.max(
                  0,
                  totals.total - paidMinor(inv.studio_payments, inv.currency)
                );
                const status = effectiveStatus(inv, today, balance);
                return (
                  <li key={inv.id}>
                    <Link
                      href={`/money/invoices/${inv.id}`}
                      className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 px-2 py-3.5 transition-colors hover:bg-raised"
                    >
                      <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
                        <p className="font-mono text-fluid-sm tracking-tight">{inv.number}</p>
                        <Chip filled={status === "overdue"}>
                          {labelFor(INVOICE_STATUSES, status)}
                        </Chip>
                      </div>
                      <p className="tnum text-fluid-sm">
                        {formatMinor(totals.total, inv.currency)}
                        {inv.status === "partially_paid" && (
                          <span className="text-muted">
                            {" "}
                            · {formatMinor(balance, inv.currency)} open
                          </span>
                        )}
                      </p>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>

      <section aria-label="Milestones" className="border-b border-line px-6 py-8 md:px-10">
        <SectionHeading>Milestones</SectionHeading>
        <div className="mt-4">
          <MilestoneSection projectId={p.id} milestones={milestones} />
        </div>
      </section>

      <section aria-label="Change requests" className="border-b border-line px-6 py-8 md:px-10">
        <SectionHeading>Change requests</SectionHeading>
        <div className="mt-4">
          <ChangeRequestSection
            projectId={p.id}
            requests={changeRequests}
            currency={p.currency}
          />
        </div>
      </section>

      <section aria-label="Handover" className="border-b border-line px-6 py-8 md:px-10">
        <SectionHeading>Handover</SectionHeading>
        <div className="mt-4">
          <HandoverSection projectId={p.id} items={handover} />
        </div>
      </section>

      <section aria-label="Correspondence" className="px-6 py-8 md:px-10">
        <div className="flex flex-wrap items-baseline justify-between gap-4">
          <SectionHeading>Project log</SectionHeading>
          {p.studio_clients && (
            <Link
              href={`/clients/${p.studio_clients.id}`}
              className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted transition-colors hover:text-fg"
            >
              Full client log
            </Link>
          )}
        </div>

        {p.client_id && (
          <div className="mt-5">
            <LogForm clientId={p.client_id} projectId={p.id} />
          </div>
        )}

        <div className="mt-8">
          {entries.length === 0 ? (
            <EmptyState
              title="Nothing logged against this project yet."
              body="Entries captured here land on the client's record too, tagged to this project."
            />
          ) : (
            <Timeline entries={entries} />
          )}
        </div>
      </section>
    </div>
  );
}
