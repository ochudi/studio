import type { Metadata } from "next";
import { getSupabase } from "@/lib/supabase";
import { LIVE_STATUSES } from "@/lib/domain";
import PageHeader from "@/components/PageHeader";
import ExpenseForm, { type ExpenseProjectOption } from "@/components/ExpenseForm";

export const metadata: Metadata = { title: "New expense" };
export const dynamic = "force-dynamic";

export default async function NewExpensePage({
  searchParams,
}: {
  searchParams: { project?: string };
}) {
  const supabase = getSupabase();
  const projects = supabase
    ? ((
        await supabase
          .from("studio_projects")
          .select("id, name")
          .in("status", LIVE_STATUSES)
          .order("created_at", { ascending: false })
      ).data ?? [])
    : [];

  return (
    <div>
      <PageHeader
        kicker="Money"
        title="New expense"
        sub="Thirty seconds, receipt included. Tag a project and it lands in that project's costs; leave it general and it stays studio overhead."
      />
      <div className="px-6 py-8 md:px-10">
        <ExpenseForm
          projects={projects as ExpenseProjectOption[]}
          presetProject={searchParams.project}
        />
      </div>
    </div>
  );
}
