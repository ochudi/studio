import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { recomputeInvoiceStatus } from "@/lib/invoice-server";

export const runtime = "nodejs";

/**
 * Payments are records, but a single-user tool needs a way to unfat-finger
 * an amount. Deleting re-mirrors the linked invoice's status immediately.
 */
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = getSupabase();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase isn't configured." }, { status: 503 });
  }

  const { data, error } = await supabase
    .from("studio_payments")
    .delete()
    .eq("id", params.id)
    .select("invoice_id");
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data || data.length === 0) {
    return NextResponse.json({ error: "No such payment." }, { status: 404 });
  }

  const invoiceId = data[0].invoice_id;
  if (invoiceId) {
    await recomputeInvoiceStatus(supabase, invoiceId);
  }
  return NextResponse.json({ ok: true });
}
