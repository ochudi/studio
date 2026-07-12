import "server-only";
import { Resend } from "resend";

/**
 * Thin Resend wrapper. Everything time-critical emails as well as pushes,
 * because Safari can purge a dormant PWA's service worker and iOS never
 * reports a revoked subscription — email is the channel that always lands.
 */

const FROM = process.env.STUDIO_FROM_EMAIL ?? "Greyform Studio <studio@greyform.org>";
const OWNER = process.env.STUDIO_OWNER_EMAIL ?? "ofoma.chudi@gmail.com";

export async function sendEmail(opts: {
  to?: string;
  subject: string;
  text: string;
  attachments?: { filename: string; content: string; contentType?: string }[];
}): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return false;
  try {
    const resend = new Resend(key);
    const { error } = await resend.emails.send({
      from: FROM,
      to: opts.to ?? OWNER,
      subject: opts.subject,
      text: opts.text,
      attachments: opts.attachments,
    });
    return !error;
  } catch {
    return false;
  }
}
