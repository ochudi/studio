import "server-only";
import webpush from "web-push";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Web push to every registered device. Payloads use the Declarative Web Push
 * envelope ({"web_push": 8030, ...}) so iOS 18.4+ shows them at OS level
 * without waking the service worker; sw.js reads the same shape everywhere
 * else. Endpoints that come back 404/410 are gone (uninstalled, revoked) and
 * get pruned so dead devices don't slow every send.
 */

let configured = false;

function ensureConfigured(): boolean {
  if (configured) return true;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return false;
  webpush.setVapidDetails("mailto:hello@greyform.org", pub, priv);
  configured = true;
  return true;
}

/** Absolute base for `navigate` — iOS parses declarative payloads strictly. */
export function appUrl(path: string): string {
  const base = process.env.STUDIO_URL ?? "https://studio.greyform.org";
  return new URL(path, base).toString();
}

export type PushPayload = { title: string; body?: string; url?: string };

type SubRow = { id: string; endpoint: string; keys: { p256dh: string; auth: string } };

async function sendToOne(supabase: SupabaseClient, sub: SubRow, payload: PushPayload): Promise<boolean> {
  const body = JSON.stringify({
    web_push: 8030,
    notification: {
      title: payload.title,
      body: payload.body ?? "",
      navigate: appUrl(payload.url ?? "/"),
    },
  });
  try {
    await webpush.sendNotification(
      { endpoint: sub.endpoint, keys: sub.keys },
      body,
      { TTL: 3600, urgency: "high" }
    );
    await supabase
      .from("studio_push_subscriptions")
      .update({ last_used_at: new Date().toISOString() })
      .eq("id", sub.id);
    return true;
  } catch (err) {
    const status = (err as { statusCode?: number }).statusCode;
    if (status === 404 || status === 410) {
      await supabase.from("studio_push_subscriptions").delete().eq("id", sub.id);
    }
    return false;
  }
}

/** Sends to one device when `deviceId` is given, otherwise to all of them. */
export async function sendPush(
  supabase: SupabaseClient,
  payload: PushPayload,
  deviceId?: string
): Promise<{ sent: number; devices: number }> {
  if (!ensureConfigured()) return { sent: 0, devices: 0 };

  let query = supabase.from("studio_push_subscriptions").select("id, endpoint, keys");
  if (deviceId) query = query.eq("id", deviceId);
  const subs = (await query).data ?? [];

  const results = await Promise.all(subs.map((s) => sendToOne(supabase, s as SubRow, payload)));
  return { sent: results.filter(Boolean).length, devices: subs.length };
}
