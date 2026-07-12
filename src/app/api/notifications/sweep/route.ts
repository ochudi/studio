import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { sweep } from "@/lib/reminders";

export const runtime = "nodejs";

/**
 * The on-open sweep: same drain as the cron, behind the normal cookie gate.
 * A bonus, not the mechanism — cron is what makes reminders arrive when the
 * app is closed.
 */
export async function POST() {
  const supabase = getSupabase();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase isn't configured." }, { status: 503 });
  }
  return NextResponse.json(await sweep(supabase));
}
