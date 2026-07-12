import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { pushSubscriptionSchema } from "@/lib/domain";

export const runtime = "nodejs";

/**
 * Upsert keyed on endpoint: the app re-posts the live subscription on every
 * open because iOS silently rotates or revokes them and never says so.
 */
export async function POST(req: NextRequest) {
  const supabase = getSupabase();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase isn't configured." }, { status: 503 });
  }

  const body = await req.json().catch(() => null);
  const parsed = pushSubscriptionSchema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return NextResponse.json({ error: first?.message ?? "Bad subscription." }, { status: 400 });
  }

  const { endpoint, keys, device_label } = parsed.data;
  const { data, error } = await supabase
    .from("studio_push_subscriptions")
    .upsert(
      { endpoint, keys, device_label: device_label ?? null, last_used_at: new Date().toISOString() },
      { onConflict: "endpoint" }
    )
    .select("id")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ id: data.id }, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const supabase = getSupabase();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase isn't configured." }, { status: 503 });
  }

  const body = await req.json().catch(() => null);
  const id = body && typeof body === "object" ? (body as { id?: string }).id : null;
  if (!id) {
    return NextResponse.json({ error: "Which device?" }, { status: 400 });
  }

  const { error } = await supabase.from("studio_push_subscriptions").delete().eq("id", id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
