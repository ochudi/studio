import type { Metadata } from "next";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";

export const metadata: Metadata = { title: "Money" };

export default function MoneyPage() {
  return (
    <div>
      <PageHeader
        kicker="Money"
        title="Invoices, payments, expenses"
        sub="Multi-currency invoices that show full value before any courtesy discount, payments as they land, expenses per project, and profit you can actually see."
      />
      <div className="px-6 py-8 md:px-10">
        <EmptyState
          title="No money movements yet."
          body="This module lands in a coming chunk: the invoice builder, payment records with receipts, expense capture and the finance overview."
        />
      </div>
    </div>
  );
}
