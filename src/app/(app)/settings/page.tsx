import type { Metadata } from "next";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";

export const metadata: Metadata = { title: "Settings" };

export default function SettingsPage() {
  return (
    <div>
      <PageHeader
        kicker="Settings"
        title="How the studio runs"
        sub="Base currency, invoice numbering, payment details per currency, notification preferences and this device's push subscription."
      />
      <div className="px-6 py-8 md:px-10">
        <EmptyState
          title="Defaults are in effect."
          body="Base currency NGN, invoice numbers GF-0001 onward. The settings surface lands alongside the money chunk."
        />
      </div>
    </div>
  );
}
