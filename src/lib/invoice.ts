/**
 * Invoice arithmetic in one place so the builder preview, the detail page,
 * the PDF and the Today snapshot can never disagree. All maths in minor
 * units; rounding happens once per step, never per render.
 */

export type Line = { quantity: number; unit_minor: number };
export type PaymentLike = { amount_minor: number; currency: string };

export type Totals = {
  gross: number;
  discountMinor: number;
  taxMinor: number;
  total: number;
};

export function lineAmount(item: Line): number {
  return Math.round(Number(item.quantity) * Number(item.unit_minor));
}

/**
 * The true-worth pattern: lines carry full value, then one named reduction,
 * then tax on what remains. Reports later read both the gross (value
 * delivered) and the total (cash expected).
 */
export function invoiceTotals(items: Line[], discountPct: number, taxPct: number): Totals {
  const gross = items.reduce((sum, it) => sum + lineAmount(it), 0);
  const discountMinor = Math.round((gross * Number(discountPct || 0)) / 100);
  const net = gross - discountMinor;
  const taxMinor = Math.round((net * Number(taxPct || 0)) / 100);
  return { gross, discountMinor, taxMinor, total: net + taxMinor };
}

/** Payments counted in the invoice's own currency only. */
export function paidMinor(payments: PaymentLike[], currency: string): number {
  return payments
    .filter((p) => p.currency === currency)
    .reduce((sum, p) => sum + Number(p.amount_minor), 0);
}

/**
 * Overdue is a fact about today, not a stored state — derived here so an
 * invoice can't stay "overdue" a second longer than it's actually unpaid.
 * Balance matters too: a fully discounted pro-bono invoice owes nothing and
 * can't be late.
 */
export function effectiveStatus(
  inv: { status: string; due_date: string | null },
  today: string,
  balanceMinor: number
): string {
  if (
    (inv.status === "sent" || inv.status === "partially_paid") &&
    balanceMinor > 0 &&
    inv.due_date &&
    inv.due_date < today
  ) {
    return "overdue";
  }
  return inv.status;
}

/** Default courtesy label from the client relationship. Editable on the invoice. */
export function courtesyLabel(relationship: string): string | null {
  if (relationship === "friends_family") return "Friends & family courtesy";
  if (relationship === "pro_bono") return "Pro bono courtesy";
  return null;
}

export function invoiceNumber(prefix: string, seq: number): string {
  return `${prefix}-${String(seq).padStart(4, "0")}`;
}
