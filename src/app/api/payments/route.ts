import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { paymentSchema } from "@/lib/domain";
import { rateToBase } from "@/lib/fx";
import { recomputeInvoiceStatus } from "@/lib/invoice-server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const supabase = getSupabase();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase isn't configured." }, { status: 503 });
  }

  const body = await req.json().catch(() => null);
  const parsed = paymentSchema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return NextResponse.json({ error: first?.message ?? "Check the form." }, { status: 400 });
  }

  const payment = { ...parsed.data };

  if (payment.invoice_id) {
    const inv = await supabase
      .from("studio_invoices")
      .select("client_id, project_id, currency, status")
      .eq("id", payment.invoice_id)
      .maybeSingle();
    if (!inv.data) {
      return NextResponse.json({ error: "No such invoice." }, { status: 404 });
    }
    if (!["sent", "partially_paid", "paid"].includes(inv.data.status)) {
      return NextResponse.json(
        { error: "Send the invoice first; money lands against sent invoices." },
        { status: 400 }
      );
    }
    if (payment.currency !== inv.data.currency) {
      return NextResponse.json(
        { error: `This invoice bills in ${inv.data.currency} — record the payment in it.` },
        { status: 400 }
      );
    }
    // The invoice knows whose money this is; don't trust the form to agree.
    payment.client_id = inv.data.client_id;
    payment.project_id = inv.data.project_id;
  }

  const fx = await rateToBase(supabase, payment.currency);
  const { data, error } = await supabase
    .from("studio_payments")
    .insert({ ...payment, fx_rate_to_base: fx })
    .select("id")
    .single();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (payment.invoice_id) {
    await recomputeInvoiceStatus(supabase, payment.invoice_id);
  }

  return NextResponse.json({ id: data.id }, { status: 201 });
}
