import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { sweep } from "@/lib/reminders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The five-minute tick (vercel.json crons). Sits outside the cookie gate —
 * middleware lets /api/cron through — so it authenticates with the shared
 * secret instead: Vercel sends `Authorization: Bearer $CRON_SECRET`
 * automatically when the env var exists.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = getSupabase();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase isn't configured." }, { status: 503 });
  }

  return NextResponse.json(await sweep(supabase));
}
