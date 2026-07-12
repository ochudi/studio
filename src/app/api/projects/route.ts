import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { projectSchema } from "@/lib/domain";
import { statusTimestamps } from "@/lib/project-status";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const supabase = getSupabase();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase isn't configured." }, { status: 503 });
  }

  const body = await req.json().catch(() => null);
  const parsed = projectSchema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return NextResponse.json({ error: first?.message ?? "Check the form." }, { status: 400 });
  }

  const { collected_minor, ...project } = parsed.data;
  const { data, error } = await supabase
    .from("studio_projects")
    .insert({ ...project, ...statusTimestamps(project.status) })
    .select("id")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Backfill: money collected before this tool existed becomes a standalone
  // payment so the finance overview counts it without inventing an invoice.
  if (collected_minor && collected_minor > 0) {
    const { error: payError } = await supabase.from("studio_payments").insert({
      client_id: project.client_id,
      project_id: data.id,
      amount_minor: collected_minor,
      currency: project.currency,
      method: "bank_transfer",
      notes: "Backfilled at project setup — collected before Studio existed.",
    });
    if (payError) {
      return NextResponse.json(
        { error: `Project saved, but recording the payment failed: ${payError.message}` },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({ id: data.id }, { status: 201 });
}
