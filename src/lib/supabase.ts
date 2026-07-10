import "server-only";
import WebSocket from "ws";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Server-only Supabase client using the service-role key. Bypasses RLS by
 * design, so this MUST NOT be imported into a client component.
 *
 * The Supabase project is shared with the site and other apps (inquiries,
 * ochudi_*, a campaigns app with generic names like `reviews`), so every
 * table this app owns carries the studio_ prefix.
 */

let cached: SupabaseClient | null | undefined;

export function getSupabase(): SupabaseClient | null {
  if (cached !== undefined) return cached;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    cached = null;
    return null;
  }

  cached = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    db: { schema: "public" },
    global: {
      // Next.js patches fetch and will happily serve yesterday's GET from
      // its Data Cache — even under force-dynamic. Financial data must
      // never be stale, so opt every Supabase request out.
      fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }),
    },
    // supabase-js eagerly constructs a RealtimeClient that demands a
    // WebSocket implementation, which Node 20 doesn't expose globally.
    realtime: { transport: WebSocket as unknown as typeof globalThis.WebSocket },
  });
  return cached;
}

/** Storage bucket for uploads and frozen copies of generated documents. */
export const STUDIO_BUCKET = "studio";
