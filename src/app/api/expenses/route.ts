import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { expenseSchema } from "@/lib/domain";
import { rateToBase } from "@/lib/fx";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const supabase = getSupabase();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase isn't configured." }, { status: 503 });
  }

  const body = await req.json().catch(() => null);
  const parsed = expenseSchema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return NextResponse.json({ error: first?.message ?? "Check the form." }, { status: 400 });
  }

  const fx = await rateToBase(supabase, parsed.data.currency);
  const { data, error } = await supabase
    .from("studio_expenses")
    .insert({ ...parsed.data, fx_rate_to_base: fx })
    .select("id")
    .single();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ id: data.id }, { status: 201 });
}
