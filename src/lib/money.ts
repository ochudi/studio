/**
 * Money is stored as minor units (kobo, cents, pence) + ISO currency code,
 * with an FX rate to the base currency snapshotted at record time so the
 * finance overview reports what things were worth when they happened.
 */

export const CURRENCIES = ["NGN", "USD", "GBP", "EUR", "CAD"] as const;

/** Settled decision: naira is what gets spent, so reports read in it. */
export const BASE_CURRENCY = "NGN";
export type Currency = (typeof CURRENCIES)[number];

const SYMBOL: Record<string, string> = {
  NGN: "₦",
  USD: "$",
  GBP: "£",
  EUR: "€",
  CAD: "CA$",
};

export function currencySymbol(code: string): string {
  return SYMBOL[code] ?? code + " ";
}

/** 1234567 minor units of NGN → "₦12,345.67" (no decimals when .00). */
export function formatMinor(minor: number | bigint, currency: string): string {
  const n = Number(minor) / 100;
  const hasCents = Math.round(n * 100) % 100 !== 0;
  return (
    currencySymbol(currency) +
    n.toLocaleString("en", {
      minimumFractionDigits: hasCents ? 2 : 0,
      maximumFractionDigits: 2,
    })
  );
}

/** "12,345.67" or "12345" → minor units. Returns null when unparseable. */
export function parseToMinor(input: string): number | null {
  const cleaned = input.replace(/[,\s]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  return Math.round(parseFloat(cleaned) * 100);
}

/** Convert minor units to base currency using a snapshotted rate. */
export function toBaseMinor(minor: number, rateToBase: number | null | undefined): number {
  if (!rateToBase || rateToBase <= 0) return minor;
  return Math.round(minor * rateToBase);
}
