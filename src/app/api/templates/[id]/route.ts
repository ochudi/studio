import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { templateEditSchema } from "@/lib/domain";

export const runtime = "nodejs";

/** Masters are edited in place; documents copied from them never change. */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = getSupabase();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase isn't configured." }, { status: 503 });
  }

  const body = await req.json().catch(() => null);
  const parsed = templateEditSchema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return NextResponse.json({ error: first?.message ?? "Check the form." }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("studio_doc_templates")
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq("id", params.id)
    .select("id");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data || data.length === 0) {
    return NextResponse.json({ error: "No such template." }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
