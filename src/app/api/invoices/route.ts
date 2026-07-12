import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { invoiceSchema } from "@/lib/domain";
import { invoiceNumber } from "@/lib/invoice";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const supabase = getSupabase();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase isn't configured." }, { status: 503 });
  }

  const body = await req.json().catch(() => null);
  const parsed = invoiceSchema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return NextResponse.json({ error: first?.message ?? "Check the form." }, { status: 400 });
  }

  const { items, ...invoice } = parsed.data;

  // Numbers come from the settings counter and never repeat; the unique
  // constraint on `number` is the backstop if two tabs race.
  const settings = await supabase
    .from("studio_settings")
    .select("invoice_prefix, next_invoice_seq")
    .eq("id", true)
    .single();
  if (settings.error) {
    return NextResponse.json({ error: settings.error.message }, { status: 500 });
  }
  const seq = settings.data.next_invoice_seq;
  const number = invoiceNumber(settings.data.invoice_prefix, seq);

  const { data, error } = await supabase
    .from("studio_invoices")
    .insert({ ...invoice, number, status: "draft" })
    .select("id")
    .single();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { error: itemsError } = await supabase.from("studio_invoice_items").insert(
    items.map((it, i) => ({ ...it, invoice_id: data.id, sort_order: i }))
  );
  if (itemsError) {
    await supabase.from("studio_invoices").delete().eq("id", data.id);
    return NextResponse.json(
      { error: `The lines didn't save: ${itemsError.message}` },
      { status: 500 }
    );
  }

  await supabase
    .from("studio_settings")
    .update({ next_invoice_seq: seq + 1, updated_at: new Date().toISOString() })
    .eq("id", true);

  return NextResponse.json({ id: data.id, number }, { status: 201 });
}
