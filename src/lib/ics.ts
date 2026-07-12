import type { StudioEvent } from "@/lib/domain";

/**
 * Hand-rolled iCalendar output — the format is small enough that a library
 * would be mostly dead weight. Two constraints matter and both live here:
 * UIDs are stable (the event's row id) and SEQUENCE climbs with updated_at,
 * so a reschedule UPDATES the entry in Apple/Google Calendar instead of
 * planting a duplicate. Times go out in UTC; the calendar app localises.
 */

/** RFC 5545 text escaping: backslash first, then structural characters. */
function esc(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/** 20260712T083000Z — iCalendar UTC timestamp. */
function utc(iso: string): string {
  return new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

/**
 * Lines longer than 75 octets must fold onto continuation lines that start
 * with a space. Folding by 74 UTF-16 units is slightly conservative for
 * multi-byte text but always valid.
 */
function fold(line: string): string {
  if (line.length <= 74) return line;
  const parts: string[] = [];
  for (let i = 0; i < line.length; i += 74) {
    parts.push((i === 0 ? "" : " ") + line.slice(i, i + 74));
  }
  return parts.join("\r\n");
}

const DEFAULT_DURATION_MS = 30 * 60000;

export function buildIcs(
  event: Pick<
    StudioEvent,
    "id" | "title" | "starts_at" | "ends_at" | "location" | "agenda" | "status" | "updated_at"
  >,
  opts: {
    /** PUBLISH for tap-to-add downloads, REQUEST for emailed invites. */
    method: "PUBLISH" | "REQUEST";
    /** Attendee for REQUEST invites; ignored for PUBLISH. */
    attendee?: { name: string; email: string };
  }
): string {
  const ends = event.ends_at ?? new Date(Date.parse(event.starts_at) + DEFAULT_DURATION_MS).toISOString();

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Greyform//Studio//EN",
    `METHOD:${opts.method}`,
    "BEGIN:VEVENT",
    `UID:${event.id}@studio.greyform.org`,
    `DTSTAMP:${utc(new Date().toISOString())}`,
    // Monotonic with every edit, which is what makes reschedules update in place.
    `SEQUENCE:${Math.floor(Date.parse(event.updated_at) / 1000) % 2147483647}`,
    `DTSTART:${utc(event.starts_at)}`,
    `DTEND:${utc(ends)}`,
    `SUMMARY:${esc(event.title)}`,
  ];

  if (event.location) lines.push(`LOCATION:${esc(event.location)}`);
  if (event.agenda) lines.push(`DESCRIPTION:${esc(event.agenda)}`);
  lines.push(`STATUS:${event.status === "cancelled" ? "CANCELLED" : "CONFIRMED"}`);

  if (opts.method === "REQUEST") {
    lines.push("ORGANIZER;CN=Chudi Ofoma:mailto:hello@greyform.org");
    if (opts.attendee) {
      lines.push(
        `ATTENDEE;CN=${esc(opts.attendee.name)};ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=TRUE:mailto:${opts.attendee.email}`
      );
    }
  }

  lines.push("END:VEVENT", "END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}
