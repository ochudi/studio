import { CHANNELS, labelFor, type Correspondence } from "@/lib/domain";
import Chip from "@/components/Chip";
import EntryActions from "@/components/EntryActions";

/**
 * The correspondence record, newest first, grouped by day in Lagos time.
 * Decisions carry a filled chip; an unresolved follow-up shows its date and
 * flips to emphasis once it's due.
 */

const dayFmt = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "Africa/Lagos",
});
const timeFmt = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Africa/Lagos",
});
const followFmt = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  timeZone: "Africa/Lagos",
});

function lagosToday(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Lagos" }).format(new Date());
}

export default function Timeline({ entries }: { entries: Correspondence[] }) {
  const today = lagosToday();
  const groups: { day: string; items: Correspondence[] }[] = [];
  for (const entry of entries) {
    const day = dayFmt.format(new Date(entry.occurred_at));
    const last = groups[groups.length - 1];
    if (last && last.day === day) last.items.push(entry);
    else groups.push({ day, items: [entry] });
  }

  return (
    <div>
      {groups.map((group) => (
        <section key={group.day} className="border-t border-line py-6 first:border-t-0">
          <h3 className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted">
            {group.day}
          </h3>
          <ul className="mt-4 space-y-5">
            {group.items.map((e) => {
              const overdue = !!e.follow_up_on && e.follow_up_on <= today;
              return (
                <li key={e.id} className="group/entry flex items-baseline gap-4">
                  <p className="tnum w-11 shrink-0 font-mono text-[10px] uppercase tracking-[0.1em] text-muted">
                    {timeFmt.format(new Date(e.occurred_at))}
                  </p>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1.5">
                      <p className="text-fluid-sm leading-relaxed">
                        <span className="text-muted">
                          {labelFor(CHANNELS, e.channel)} {e.direction === "in" ? "from them" : "from me"} ·{" "}
                        </span>
                        {e.summary}
                      </p>
                      {e.is_decision && <Chip filled>Decision</Chip>}
                      {e.follow_up_on && (
                        <Chip filled={overdue}>
                          Follow up · {followFmt.format(new Date(e.follow_up_on + "T12:00:00Z"))}
                        </Chip>
                      )}
                    </div>
                    {e.body && (
                      <p className="mt-1.5 max-w-[64ch] whitespace-pre-line text-fluid-xs leading-relaxed text-muted">
                        {e.body}
                      </p>
                    )}
                  </div>
                  {/* Always visible on touch screens; hover-revealed on desktop. */}
                  <span className="transition-opacity focus-within:opacity-100 group-hover/entry:opacity-100 sm:opacity-0">
                    <EntryActions id={e.id} hasFollowUp={!!e.follow_up_on} />
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
