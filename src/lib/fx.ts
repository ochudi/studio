import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { BASE_CURRENCY } from "@/lib/money";

/**
 * FX rates to base, snapshotted onto invoices and payments at the moment
 * they happen so the finance overview reports what things were worth then,
 * not what the market says later. Daily cache in studio_fx_rates; rows
 * written by hand double as the manual-override surface.
 *
 * Never blocks the money from being recorded: if the rate API is down and
 * the cache is empty, the snapshot is simply null and can be backfilled.
 */

function lagosToday(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Lagos" }).format(new Date());
}

export async function rateToBase(
  supabase: SupabaseClient,
  currency: string
): Promise<number | null> {
  if (currency === BASE_CURRENCY) return 1;

  const today = lagosToday();
  const cached = await supabase
    .from("studio_fx_rates")
    .select("rate_to_base")
    .eq("currency", currency)
    .eq("as_of", today)
    .maybeSingle();
  if (cached.data) return Number(cached.data.rate_to_base);

  try {
    const res = await fetch(`https://open.er-api.com/v6/latest/${currency}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(6000),
    });
    const body = await res.json();
    const rate = Number(body?.rates?.[BASE_CURRENCY]);
    if (Number.isFinite(rate) && rate > 0) {
      await supabase
        .from("studio_fx_rates")
        .upsert({ currency, as_of: today, rate_to_base: rate, source: "api" });
      return rate;
    }
  } catch {
    // Fall through to the most recent cached rate.
  }

  const recent = await supabase
    .from("studio_fx_rates")
    .select("rate_to_base")
    .eq("currency", currency)
    .order("as_of", { ascending: false })
    .limit(1)
    .maybeSingle();
  return recent.data ? Number(recent.data.rate_to_base) : null;
}
