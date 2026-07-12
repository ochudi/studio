import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { invoiceTotals, paidMinor } from "@/lib/invoice";

/**
 * Payments are the source of truth for whether an invoice is paid; the
 * stored status just mirrors them. Called after every payment insert or
 * delete so the mirror can't drift.
 */
export async function recomputeInvoiceStatus(
  supabase: SupabaseClient,
  invoiceId: string
): Promise<void> {
  const [invRes, itemsRes, payRes] = await Promise.all([
    supabase
      .from("studio_invoices")
      .select("status, currency, discount_pct, tax_pct, paid_at")
      .eq("id", invoiceId)
      .maybeSingle(),
    supabase.from("studio_invoice_items").select("quantity, unit_minor").eq("invoice_id", invoiceId),
    supabase.from("studio_payments").select("amount_minor, currency").eq("invoice_id", invoiceId),
  ]);

  const inv = invRes.data;
  if (!inv) return;
  // Drafts, voids and write-offs keep their status regardless of money.
  if (!["sent", "partially_paid", "paid"].includes(inv.status)) return;

  const { total } = invoiceTotals(
    itemsRes.data ?? [],
    Number(inv.discount_pct),
    Number(inv.tax_pct)
  );
  const paid = paidMinor(payRes.data ?? [], inv.currency);
  const status = total > 0 && paid >= total ? "paid" : paid > 0 ? "partially_paid" : "sent";

  await supabase
    .from("studio_invoices")
    .update({
      status,
      paid_at: status === "paid" ? inv.paid_at ?? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", invoiceId);
}
