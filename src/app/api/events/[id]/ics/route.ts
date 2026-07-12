import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { buildIcs } from "@/lib/ics";

export const runtime = "nodejs";

/** Tap-to-add: downloads the event for Apple/Google Calendar. */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = getSupabase();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase isn't configured." }, { status: 503 });
  }

  const event = (
    await supabase
      .from("studio_events")
      .select("id, title, starts_at, ends_at, location, agenda, status, updated_at")
      .eq("id", params.id)
      .maybeSingle()
  ).data;
  if (!event) {
    return NextResponse.json({ error: "No such event." }, { status: 404 });
  }

  return new NextResponse(buildIcs(event, { method: "PUBLISH" }), {
    headers: {
      "content-type": "text/calendar; charset=utf-8",
      "content-disposition": `attachment; filename="greyform-${event.id.slice(0, 8)}.ics"`,
      "cache-control": "no-store",
    },
  });
}
