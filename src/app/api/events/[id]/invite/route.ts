import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { buildIcs } from "@/lib/ics";
import { sendEmail } from "@/lib/email";

export const runtime = "nodejs";

/**
 * Emails the client a METHOD:REQUEST invite. The stable UID means sending
 * again after a reschedule updates the entry in their calendar instead of
 * duplicating it. Fired only by an explicit tap — nothing here is automatic.
 */
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = getSupabase();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase isn't configured." }, { status: 503 });
  }

  const event = (
    await supabase
      .from("studio_events")
      .select(
        "id, title, starts_at, ends_at, location, agenda, status, updated_at, studio_clients(name, email)"
      )
      .eq("id", params.id)
      .maybeSingle()
  ).data;
  if (!event) {
    return NextResponse.json({ error: "No such event." }, { status: 404 });
  }
  if (event.status !== "scheduled") {
    return NextResponse.json({ error: "Only scheduled events can be sent." }, { status: 409 });
  }

  const client = event.studio_clients as unknown as { name: string; email: string | null } | null;
  if (!client?.email) {
    return NextResponse.json(
      { error: "The client has no email on file. Add one on their record first." },
      { status: 400 }
    );
  }

  const ics = buildIcs(event, {
    method: "REQUEST",
    attendee: { name: client.name, email: client.email },
  });

  const when = new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Africa/Lagos",
  }).format(new Date(event.starts_at));

  const ok = await sendEmail({
    to: client.email,
    subject: `Invitation: ${event.title}`,
    text: [
      `Hi ${client.name.split(" ")[0]},`,
      "",
      `Calendar invite for ${event.title} on ${when} (Lagos time).`,
      event.location ? `Where: ${event.location}` : null,
      event.agenda ? `\n${event.agenda}` : null,
      "",
      "Chudi · Greyform",
    ]
      .filter((l) => l !== null)
      .join("\n"),
    attachments: [
      {
        filename: "invite.ics",
        content: Buffer.from(ics).toString("base64"),
        contentType: "text/calendar; method=REQUEST",
      },
    ],
  });

  if (!ok) {
    return NextResponse.json({ error: "The invite didn't send. Try again." }, { status: 502 });
  }
  return NextResponse.json({ ok: true });
}
