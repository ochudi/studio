import type { Metadata } from "next";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";

export const metadata: Metadata = { title: "Projects" };

export default function ProjectsPage() {
  return (
    <div>
      <PageHeader
        kicker="Projects"
        title="The work, end to end"
        sub="Lead to proposal to contract to delivery to closeout or retainer, with milestones, decisions and profitability on one page per project."
      />
      <div className="px-6 py-8 md:px-10">
        <EmptyState
          title="No projects yet."
          body="This module lands in the next build chunk: the pipeline board, per-project timelines, change requests and the handover vault."
        />
      </div>
    </div>
  );
}
