import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { projectSchema } from "@/lib/domain";
import { statusTimestamps } from "@/lib/project-status";

export const runtime = "nodejs";

const updateSchema = projectSchema.omit({ collected_minor: true }).partial();

/**
 * Partial update: the edit form sends the whole record, the status control
 * sends just { status }. Lifecycle timestamps only move when the status
 * actually changes, so editing a note never rewrites delivery history.
 */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = getSupabase();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase isn't configured." }, { status: 503 });
  }

  const body = await req.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return NextResponse.json({ error: first?.message ?? "Check the form." }, { status: 400 });
  }

  let patch: Record<string, unknown> = { ...parsed.data };
  if (parsed.data.status) {
    const { data: current } = await supabase
      .from("studio_projects")
      .select("status")
      .eq("id", params.id)
      .maybeSingle();
    if (current && current.status !== parsed.data.status) {
      patch = { ...patch, ...statusTimestamps(parsed.data.status) };
    }
  }

  const { error } = await supabase.from("studio_projects").update(patch).eq("id", params.id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
