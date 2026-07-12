import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { eventSchema } from "@/lib/domain";
import { syncEventReminders } from "@/lib/reminders";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const supabase = getSupabase();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase isn't configured." }, { status: 503 });
  }

  const body = await req.json().catch(() => null);
  const parsed = eventSchema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return NextResponse.json({ error: first?.message ?? "Check the form." }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("studio_events")
    .insert(parsed.data)
    .select("id, client_id, project_id, title, kind, starts_at, status, remind_minutes")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  await syncEventReminders(supabase, data);
  return NextResponse.json({ id: data.id }, { status: 201 });
}
