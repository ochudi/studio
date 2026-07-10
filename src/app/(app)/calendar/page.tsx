import type { Metadata } from "next";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";

export const metadata: Metadata = { title: "Calendar" };

export default function CalendarPage() {
  return (
    <div>
      <PageHeader
        kicker="Calendar"
        title="What happens when"
        sub="Calls, kickoffs and deadlines across every project — with reminders that reach your phone before the client does."
      />
      <div className="px-6 py-8 md:px-10">
        <EmptyState
          title="Nothing scheduled."
          body="This module lands in a coming chunk: month and agenda views, pre-call context cards, .ics invites and push reminders."
        />
      </div>
    </div>
  );
}
