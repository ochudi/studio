import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { eventSchema, eventCloseSchema } from "@/lib/domain";
import { syncEventReminders } from "@/lib/reminders";

export const runtime = "nodejs";

/**
 * PATCH closes out ({status, outcome}) or reschedules/edits (full event
 * shape, scheduled only). Both paths resync the unsent reminders so a moved
 * call never fires the old alarm.
 */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = getSupabase();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase isn't configured." }, { status: 503 });
  }

  const current = (
    await supabase.from("studio_events").select("id, status").eq("id", params.id).maybeSingle()
  ).data;
  if (!current) {
    return NextResponse.json({ error: "No such event." }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  const closing = body && typeof body === "object" && "status" in body;

  if (closing) {
    const parsed = eventCloseSchema.safeParse(body);
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      return NextResponse.json({ error: first?.message ?? "Check the form." }, { status: 400 });
    }
    // Outcome notes can still be added or refined after the first close-out;
    // only re-opening is off the table.
    if (current.status !== "scheduled" && current.status !== parsed.data.status) {
      return NextResponse.json(
        { error: "This event is already closed out." },
        { status: 409 }
      );
    }
    const { error } = await supabase
      .from("studio_events")
      .update({ status: parsed.data.status, outcome: parsed.data.outcome ?? null })
      .eq("id", params.id);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    // Closed events need no alarms.
    await supabase.from("studio_reminders").delete().eq("event_id", params.id).is("sent_at", null);
    return NextResponse.json({ ok: true });
  }

  if (current.status !== "scheduled") {
    return NextResponse.json(
      { error: "Only scheduled events can be edited. Past events are the record." },
      { status: 409 }
    );
  }

  const parsed = eventSchema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return NextResponse.json({ error: first?.message ?? "Check the form." }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("studio_events")
    .update(parsed.data)
    .eq("id", params.id)
    .select("id, client_id, project_id, title, kind, starts_at, status, remind_minutes")
    .single();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  await syncEventReminders(supabase, data);
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = getSupabase();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase isn't configured." }, { status: 503 });
  }

  const current = (
    await supabase.from("studio_events").select("status").eq("id", params.id).maybeSingle()
  ).data;
  if (!current) {
    return NextResponse.json({ error: "No such event." }, { status: 404 });
  }
  if (current.status !== "scheduled") {
    return NextResponse.json(
      { error: "Closed-out events stay on the record. Cancel was the delete." },
      { status: 409 }
    );
  }

  const { error } = await supabase.from("studio_events").delete().eq("id", params.id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
