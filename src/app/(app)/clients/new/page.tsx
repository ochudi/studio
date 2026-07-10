import type { Metadata } from "next";
import PageHeader from "@/components/PageHeader";
import ClientForm from "@/components/ClientForm";

export const metadata: Metadata = { title: "New client" };

export default function NewClientPage() {
  return (
    <div>
      <PageHeader
        kicker="Clients"
        title="New client"
        sub="Only the name is required. Everything else can arrive as you learn it."
      />
      <div className="px-6 py-8 md:px-10">
        <ClientForm />
      </div>
    </div>
  );
}
