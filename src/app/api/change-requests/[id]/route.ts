import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

export const runtime = "nodejs";

const TRANSITIONS: Record<string, string[]> = {
  draft: ["sent"],
  sent: ["approved", "rejected"],
  approved: [],
  rejected: ["sent"],
};

/**
 * { status } moves a change request through draft → sent → approved/rejected.
 * The order is enforced here because the whole point of the record is that
 * work starts after approval, not before.
 */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = getSupabase();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase isn't configured." }, { status: 503 });
  }

  const body = await req.json().catch(() => null);
  const next = body?.status;
  if (typeof next !== "string") {
    return NextResponse.json({ error: "Nothing to change." }, { status: 400 });
  }

  const { data: current } = await supabase
    .from("studio_change_requests")
    .select("status")
    .eq("id", params.id)
    .maybeSingle();
  if (!current) {
    return NextResponse.json({ error: "That change request is gone." }, { status: 404 });
  }
  if (!TRANSITIONS[current.status]?.includes(next)) {
    return NextResponse.json(
      { error: `Can't move a ${current.status} change request to ${next}.` },
      { status: 400 }
    );
  }

  const now = new Date().toISOString();
  const patch =
    next === "sent"
      ? { status: next, sent_at: now, decided_at: null }
      : { status: next, decided_at: now };

  const { error } = await supabase.from("studio_change_requests").update(patch).eq("id", params.id);
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
  // Only drafts can be deleted; anything sent is a record the client saw.
  const { data, error } = await supabase
    .from("studio_change_requests")
    .delete()
    .eq("id", params.id)
    .eq("status", "draft")
    .select("id");
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data?.length) {
    return NextResponse.json(
      { error: "Only drafts can be deleted. Sent requests are the record." },
      { status: 400 }
    );
  }
  return NextResponse.json({ ok: true });
}
