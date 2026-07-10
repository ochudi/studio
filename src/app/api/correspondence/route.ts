import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { correspondenceSchema } from "@/lib/domain";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const supabase = getSupabase();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase isn't configured." }, { status: 503 });
  }

  const body = await req.json().catch(() => null);
  const parsed = correspondenceSchema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return NextResponse.json({ error: first?.message ?? "Check the entry." }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("studio_correspondence")
    .insert(parsed.data)
    .select("id")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ id: data.id }, { status: 201 });
}
