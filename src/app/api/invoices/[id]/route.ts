import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSupabase } from "@/lib/supabase";
import { invoiceSchema } from "@/lib/domain";
import { rateToBase } from "@/lib/fx";

export const runtime = "nodejs";

/**
 * Two kinds of PATCH, mirroring change requests: `{ status }` walks the
 * lifecycle (order enforced here, not trusted from the client), anything
 * else edits the invoice — drafts only, because a sent invoice is the
 * record the client holds.
 */

const TRANSITIONS: Record<string, string[]> = {
  draft: ["sent"],
  sent: ["void", "written_off"],
  partially_paid: ["written_off"],
  paid: [],
  void: [],
  written_off: [],
};

const statusSchema = z.object({
  status: z.enum(["sent", "void", "written_off"]),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = getSupabase();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase isn't configured." }, { status: 503 });
  }

  const body = await req.json().catch(() => null);

  if (body && typeof body === "object" && "status" in body && Object.keys(body).length === 1) {
    const parsed = statusSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "That isn't a move an invoice makes." }, { status: 400 });
    }

    const current = await supabase
      .from("studio_invoices")
      .select("status, currency, fx_rate_to_base")
      .eq("id", params.id)
      .maybeSingle();
    if (!current.data) {
      return NextResponse.json({ error: "No such invoice." }, { status: 404 });
    }
    if (!TRANSITIONS[current.data.status]?.includes(parsed.data.status)) {
      return NextResponse.json(
        { error: `An invoice can't go from ${current.data.status} to ${parsed.data.status}.` },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();
    const patch: Record<string, unknown> = { status: parsed.data.status, updated_at: now };
    if (parsed.data.status === "sent") {
      patch.sent_at = now;
      // Freeze the rate the moment the invoice goes out the door.
      patch.fx_rate_to_base =
        current.data.fx_rate_to_base ?? (await rateToBase(supabase, current.data.currency));
    }
    if (parsed.data.status === "void") patch.voided_at = now;

    const { error } = await supabase.from("studio_invoices").update(patch).eq("id", params.id);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  const parsed = invoiceSchema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return NextResponse.json({ error: first?.message ?? "Check the form." }, { status: 400 });
  }

  const current = await supabase
    .from("studio_invoices")
    .select("status")
    .eq("id", params.id)
    .maybeSingle();
  if (!current.data) {
    return NextResponse.json({ error: "No such invoice." }, { status: 404 });
  }
  if (current.data.status !== "draft") {
    return NextResponse.json(
      { error: "Only drafts can be edited. A sent invoice is the record." },
      { status: 400 }
    );
  }

  const { items, ...invoice } = parsed.data;
  const { error } = await supabase
    .from("studio_invoices")
    .update({ ...invoice, updated_at: new Date().toISOString() })
    .eq("id", params.id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Lines are replaced wholesale; a draft has no history worth preserving.
  const del = await supabase.from("studio_invoice_items").delete().eq("invoice_id", params.id);
  if (del.error) {
    return NextResponse.json({ error: del.error.message }, { status: 500 });
  }
  const ins = await supabase.from("studio_invoice_items").insert(
    items.map((it, i) => ({ ...it, invoice_id: params.id, sort_order: i }))
  );
  if (ins.error) {
    return NextResponse.json({ error: `The lines didn't save: ${ins.error.message}` }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = getSupabase();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase isn't configured." }, { status: 503 });
  }

  const { data, error } = await supabase
    .from("studio_invoices")
    .delete()
    .eq("id", params.id)
    .eq("status", "draft")
    .select("id");
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data || data.length === 0) {
    return NextResponse.json(
      { error: "Only drafts can be deleted. Void a sent invoice instead." },
      { status: 400 }
    );
  }
  return NextResponse.json({ ok: true });
}
