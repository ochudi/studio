import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { renderDocx } from "@/lib/doc-docx";
import type { DocContent } from "@/lib/doc-blocks";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const dateFmt = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "Africa/Lagos",
});

/** The editable download; always rendered live from the same blocks. */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = getSupabase();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase isn't configured." }, { status: 503 });
  }

  const doc = await supabase
    .from("studio_documents")
    .select("title, content, sent_at, studio_clients(name)")
    .eq("id", params.id)
    .maybeSingle();
  if (!doc.data?.content) return NextResponse.json({ error: "No such document." }, { status: 404 });

  const buffer = await renderDocx({
    title: doc.data.title,
    clientName: (doc.data.studio_clients as { name?: string } | null)?.name ?? null,
    dateLine: dateFmt.format(doc.data.sent_at ? new Date(doc.data.sent_at) : new Date()),
    content: doc.data.content as DocContent,
  });

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "content-type":
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "content-disposition": `attachment; filename="${doc.data.title.replace(/[^\w .-]/g, "")}.docx"`,
      "cache-control": "no-store",
    },
  });
}
