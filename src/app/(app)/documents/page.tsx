import type { Metadata } from "next";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";

export const metadata: Metadata = { title: "Documents" };

export default function DocumentsPage() {
  return (
    <div>
      <PageHeader
        kicker="Documents"
        title="Proposals, contracts, packs"
        sub="Written once, branded properly, exported as PDF or DOC. Signed copies come back in and live next to the version they signed."
      />
      <div className="px-6 py-8 md:px-10">
        <EmptyState
          title="No documents yet."
          body="This module lands in a coming chunk: the document editor, Greyform-branded templates, PDF and DOC export, and signed-copy uploads."
        />
      </div>
    </div>
  );
}
