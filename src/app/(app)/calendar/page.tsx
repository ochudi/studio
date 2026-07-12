import type { Metadata } from "next";
import Link from "next/link";
import { getSupabase } from "@/lib/supabase";
import { labelFor, EVENT_KINDS } from "@/lib/domain";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import Chip from "@/components/Chip";

export const metadata: Metadata = { title: "Calendar" };
export const dynamic = "force-dynamic";

/**
 * Month grid plus the two lists that actually run the week: what's coming
 * in the next fortnight and which past events still owe an outcome note.
 * All dates think in Lagos; the database stores UTC.
 */

const LAGOS = "Africa/Lagos";

type EventRow = {
  id: string;
  title: string;
  kind: string;
  status: string;
  starts_at: string;
  studio_clients: { name: string } | null;
};

const dayKeyFmt = new Intl.DateTimeFormat("en-CA", { timeZone: LAGOS });
const timeFmt = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: LAGOS,
});
const agendaDayFmt = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  day: "numeric",
  month: "short",
  timeZone: LAGOS,
});
const monthTitleFmt = new Intl.DateTimeFormat("en-GB", {
  month: "long",
  year: "numeric",
  timeZone: LAGOS,
});

function parseMonth(m: string | undefined): { year: number; month: number } {
  const match = m?.match(/^(\d{4})-(\d{2})$/);
  if (match) {
    const year = Number(match[1]);
    const month = Number(match[2]);
    if (month >= 1 && month <= 12) return { year, month };
  }
  const [y, mo] = dayKeyFmt.format(new Date()).split("-").map(Number);
  return { year: y, month: mo };
}

const pad = (n: number) => String(n).padStart(2, "0");

function monthParam(year: number, month: number): string {
  return `${year}-${pad(month)}`;
}

function shiftMonth(year: number, month: number, by: number): { year: number; month: number } {
  const idx = year * 12 + (month - 1) + by;
  return { year: Math.floor(idx / 12), month: (idx % 12) + 1 };
}

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: { m?: string };
}) {
  const supabase = getSupabase();
  const { year, month } = parseMonth(searchParams.m);

  // Lagos is UTC+1 year-round, so month boundaries pin cleanly.
  const monthStart = new Date(`${monthParam(year, month)}-01T00:00:00+01:00`);
  const next = shiftMonth(year, month, 1);
  const prev = shiftMonth(year, month, -1);
  const monthEnd = new Date(`${monthParam(next.year, next.month)}-01T00:00:00+01:00`);
  const now = new Date();
  const horizon = new Date(now.getTime() + 14 * 86400000);

  const select = "id, title, kind, status, starts_at, studio_clients(name)";
  const [monthEvents, upcoming, unresolved] = supabase
    ? await Promise.all([
        supabase
          .from("studio_events")
          .select(select)
          .gte("starts_at", monthStart.toISOString())
          .lt("starts_at", monthEnd.toISOString())
          .order("starts_at"),
        supabase
          .from("studio_events")
          .select(select)
          .eq("status", "scheduled")
          .gte("starts_at", now.toISOString())
          .lt("starts_at", horizon.toISOString())
          .order("starts_at"),
        supabase
          .from("studio_events")
          .select(select)
          .eq("status", "scheduled")
          .lt("starts_at", now.toISOString())
          .order("starts_at", { ascending: false })
          .limit(6),
      ]).then((r) => r.map((q) => (q.data ?? []) as unknown as EventRow[]))
    : [[], [], []];

  const byDay = new Map<string, EventRow[]>();
  for (const e of monthEvents) {
    const key = dayKeyFmt.format(new Date(e.starts_at));
    byDay.set(key, [...(byDay.get(key) ?? []), e]);
  }

  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  // Monday-first offset of the 1st; noon dodges any boundary arithmetic.
  const firstDow = new Date(`${monthParam(year, month)}-01T12:00:00+01:00`).getUTCDay();
  const leading = (firstDow + 6) % 7;
  const cells: (number | null)[] = [
    ...Array.from({ length: leading }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const todayKey = dayKeyFmt.format(now);

  return (
    <div>
      <PageHeader
        kicker="Calendar"
        title="What happens when"
        sub="Calls, deadlines and milestones with reminders that reach your phone before the client does. Every date reads Lagos time."
      >
        <Link
          href="/calendar/new"
          className="inline-flex items-center rounded-full bg-fg px-5 py-2.5 font-mono text-fluid-xs uppercase tracking-[0.18em] text-bg transition-opacity duration-300 hover:opacity-85"
        >
          New event
        </Link>
      </PageHeader>

      <section aria-label="Month" className="border-b border-line px-6 py-8 md:px-10">
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="font-display text-fluid-xl tracking-tightest">
            {monthTitleFmt.format(monthStart)}
          </h2>
          <div className="flex items-center gap-1 font-mono text-fluid-xs uppercase tracking-[0.16em]">
            <Link
              href={`/calendar?m=${monthParam(prev.year, prev.month)}`}
              aria-label="Previous month"
              className="px-3 py-2 text-muted transition-colors hover:text-fg"
            >
              ←
            </Link>
            <Link href="/calendar" className="px-2 py-2 text-muted transition-colors hover:text-fg">
              Today
            </Link>
            <Link
              href={`/calendar?m=${monthParam(next.year, next.month)}`}
              aria-label="Next month"
              className="px-3 py-2 text-muted transition-colors hover:text-fg"
            >
              →
            </Link>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-7 gap-px border border-line bg-line">
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
            <div
              key={d}
              className="bg-bg px-2 py-2 text-center font-mono text-[10px] uppercase tracking-[0.16em] text-muted"
            >
              <span className="hidden sm:inline">{d}</span>
              <span className="sm:hidden">{d[0]}</span>
            </div>
          ))}
          {cells.map((day, i) => {
            if (day === null) {
              return <div key={`blank-${i}`} className="min-h-14 bg-bg sm:min-h-24" />;
            }
            const key = `${monthParam(year, month)}-${pad(day)}`;
            const events = byDay.get(key) ?? [];
            const isToday = key === todayKey;
            return (
              <div key={key} className="min-h-14 bg-bg p-1.5 sm:min-h-24 sm:p-2">
                <p
                  className={
                    isToday
                      ? "tnum inline-flex h-6 w-6 items-center justify-center rounded-full bg-fg font-mono text-[11px] text-bg"
                      : "tnum font-mono text-[11px] text-muted"
                  }
                >
                  {day}
                </p>
                {/* Phones get dots; titles need room to breathe. */}
                {events.length > 0 && (
                  <p className="mt-1 flex gap-0.5 sm:hidden" aria-label={`${events.length} events`}>
                    {events.slice(0, 3).map((e) => (
                      <span key={e.id} aria-hidden className="inline-block h-1 w-1 rounded-full bg-fg" />
                    ))}
                  </p>
                )}
                <ul className="mt-1 hidden space-y-0.5 sm:block">
                  {events.slice(0, 3).map((e) => (
                    <li key={e.id}>
                      <Link
                        href={`/calendar/${e.id}`}
                        className={`block truncate rounded px-1 py-0.5 text-[11px] leading-snug transition-colors hover:bg-raised ${
                          e.status === "cancelled" ? "text-muted line-through" : ""
                        }`}
                      >
                        <span className="tnum font-mono text-[10px] text-muted">
                          {timeFmt.format(new Date(e.starts_at))}
                        </span>{" "}
                        {e.title}
                      </Link>
                    </li>
                  ))}
                  {events.length > 3 && (
                    <li className="px-1 font-mono text-[10px] text-muted">+{events.length - 3} more</li>
                  )}
                </ul>
              </div>
            );
          })}
        </div>
      </section>

      {unresolved.length > 0 && (
        <section aria-label="Waiting on an outcome" className="border-b border-line px-6 py-8 md:px-10">
          <p className="font-mono text-fluid-xs uppercase tracking-[0.18em] text-muted">
            Waiting on an outcome
          </p>
          <ul className="mt-4 divide-y divide-line border-y border-line">
            {unresolved.map((e) => (
              <li key={e.id}>
                <Link
                  href={`/calendar/${e.id}`}
                  className="flex items-center justify-between gap-4 px-2 py-3.5 transition-colors hover:bg-raised"
                >
                  <p className="min-w-0 truncate text-fluid-sm">
                    {e.studio_clients?.name && (
                      <span className="text-muted">{e.studio_clients.name} · </span>
                    )}
                    {e.title}
                  </p>
                  <Chip>{agendaDayFmt.format(new Date(e.starts_at))}</Chip>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-label="Coming up" className="px-6 py-8 md:px-10">
        <p className="font-mono text-fluid-xs uppercase tracking-[0.18em] text-muted">
          The next fortnight
        </p>
        <div className="mt-4">
          {upcoming.length === 0 ? (
            <EmptyState
              title="Clear diary."
              body="Nothing scheduled in the next two weeks. Add calls and deadlines and the reminders take care of themselves."
            />
          ) : (
            <ul className="divide-y divide-line border-y border-line">
              {upcoming.map((e) => (
                <li key={e.id}>
                  <Link
                    href={`/calendar/${e.id}`}
                    className="flex items-center justify-between gap-4 px-2 py-4 transition-colors hover:bg-raised"
                  >
                    <div className="flex min-w-0 items-baseline gap-4">
                      <p className="tnum shrink-0 font-mono text-[11px] uppercase tracking-[0.12em] text-muted">
                        {agendaDayFmt.format(new Date(e.starts_at))} ·{" "}
                        {timeFmt.format(new Date(e.starts_at))}
                      </p>
                      <p className="min-w-0 truncate text-fluid-sm">
                        {e.studio_clients?.name && (
                          <span className="text-muted">{e.studio_clients.name} · </span>
                        )}
                        {e.title}
                      </p>
                    </div>
                    <Chip className="hidden sm:inline-flex">{labelFor(EVENT_KINDS, e.kind)}</Chip>
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
