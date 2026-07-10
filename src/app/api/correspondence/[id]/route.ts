import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

export const runtime = "nodejs";

type Params = { params: { id: string } };

/** Currently one mutation: clearing a follow-up once it's handled. */
export async function PATCH(req: NextRequest, { params }: Params) {
  const supabase = getSupabase();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase isn't configured." }, { status: 503 });
  }

  const body = await req.json().catch(() => null);
  if (!body || body.follow_up_done !== true) {
    return NextResponse.json({ error: "Nothing to change." }, { status: 400 });
  }

  const { error } = await supabase
    .from("studio_correspondence")
    .update({ follow_up_on: null })
    .eq("id", params.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const supabase = getSupabase();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase isn't configured." }, { status: 503 });
  }

  const { error } = await supabase
    .from("studio_correspondence")
    .delete()
    .eq("id", params.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
