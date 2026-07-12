import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { createElement } from "react";
import { getSupabase } from "@/lib/supabase";
import { InvoicePdf } from "@/lib/invoice-pdf";
import type { Client, Invoice, InvoiceItem, Payment, PaymentDetail } from "@/lib/domain";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = getSupabase();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase isn't configured." }, { status: 503 });
  }

  const [invRes, itemsRes, payRes, settingsRes] = await Promise.all([
    supabase
      .from("studio_invoices")
      .select("*, studio_clients(*), studio_projects(name)")
      .eq("id", params.id)
      .maybeSingle(),
    supabase
      .from("studio_invoice_items")
      .select("*")
      .eq("invoice_id", params.id)
      .order("sort_order", { ascending: true }),
    supabase.from("studio_payments").select("*").eq("invoice_id", params.id),
    supabase.from("studio_settings").select("payment_details").eq("id", true).single(),
  ]);

  const row = invRes.data as
    | (Invoice & { studio_clients: Client | null; studio_projects: { name: string } | null })
    | null;
  if (!row || !row.studio_clients) {
    return NextResponse.json({ error: "No such invoice." }, { status: 404 });
  }
  const { studio_clients: client, studio_projects: project, ...invoice } = row;

  const details = (settingsRes.data?.payment_details ?? {}) as Record<string, PaymentDetail>;

  const doc = createElement(InvoicePdf, {
    invoice: invoice as Invoice,
    items: (itemsRes.data ?? []) as InvoiceItem[],
    client,
    payments: (payRes.data ?? []) as Payment[],
    paymentDetail: details[invoice.currency] ?? null,
    projectName: project?.name ?? null,
    // renderToBuffer wants a <Document> element; ours renders one.
  }) as unknown as Parameters<typeof renderToBuffer>[0];
  const buffer = await renderToBuffer(doc);

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `inline; filename="${invoice.number}.pdf"`,
      "cache-control": "no-store",
    },
  });
}
