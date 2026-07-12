import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

export const runtime = "nodejs";

/** { done: boolean } toggles completion; anything else edits the fields. */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = getSupabase();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase isn't configured." }, { status: 503 });
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Nothing to change." }, { status: 400 });
  }

  const patch =
    "done" in body
      ? { completed_at: body.done ? new Date().toISOString() : null }
      : {
          title: typeof body.title === "string" ? body.title.trim() : undefined,
          description: typeof body.description === "string" ? body.description : undefined,
          due_date: body.due_date === null || typeof body.due_date === "string" ? body.due_date : undefined,
        };

  const { error } = await supabase.from("studio_milestones").update(patch).eq("id", params.id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = getSupabase();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase isn't configured." }, { status: 503 });
  }
  const { error } = await supabase.from("studio_milestones").delete().eq("id", params.id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
