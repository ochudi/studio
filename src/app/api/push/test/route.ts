import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { sendPush } from "@/lib/push";

export const runtime = "nodejs";

/** The settings-page test button: proves the pipe end to end, per device. */
export async function POST(req: NextRequest) {
  const supabase = getSupabase();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase isn't configured." }, { status: 503 });
  }

  const body = await req.json().catch(() => null);
  const deviceId =
    body && typeof body === "object" ? (body as { id?: string }).id : undefined;

  const result = await sendPush(
    supabase,
    { title: "Test from Studio", body: "The pipe works. This is what a nudge feels like.", url: "/settings" },
    deviceId ?? undefined
  );

  if (result.devices === 0) {
    return NextResponse.json({ error: "No registered devices to send to." }, { status: 404 });
  }
  if (result.sent === 0) {
    return NextResponse.json(
      { error: "The push didn't go through. The subscription may have been revoked — try enabling again." },
      { status: 502 }
    );
  }
  return NextResponse.json(result);
}
