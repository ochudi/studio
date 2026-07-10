import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { clientSchema } from "@/lib/domain";

export const runtime = "nodejs";

type Params = { params: { id: string } };

export async function PATCH(req: NextRequest, { params }: Params) {
  const supabase = getSupabase();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase isn't configured." }, { status: 503 });
  }

  const body = await req.json().catch(() => null);

  // Restoring from the archive is its own tiny mutation, not a form save.
  if (body && body.unarchive === true) {
    const { error } = await supabase
      .from("studio_clients")
      .update({ archived_at: null })
      .eq("id", params.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  const parsed = clientSchema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return NextResponse.json({ error: first?.message ?? "Check the form." }, { status: 400 });
  }

  const { error } = await supabase
    .from("studio_clients")
    .update(parsed.data)
    .eq("id", params.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

/**
 * Archive, not delete: correspondence and payment history stay intact.
 * There is deliberately no hard-delete path for clients.
 */
export async function DELETE(_req: NextRequest, { params }: Params) {
  const supabase = getSupabase();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase isn't configured." }, { status: 503 });
  }

  const { error } = await supabase
    .from("studio_clients")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", params.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
