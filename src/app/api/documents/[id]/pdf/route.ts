import { NextRequest, NextResponse } from "next/server";
import { createElement } from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { getSupabase, STUDIO_BUCKET } from "@/lib/supabase";
import { DocPdf } from "@/lib/doc-pdf";
import type { DocContent } from "@/lib/doc-blocks";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const dateFmt = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "Africa/Lagos",
});

/**
 * Drafts render live; anything that went out serves the frozen as-sent
 * copy from the bucket, so the download always matches what the client
 * actually received.
 */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = getSupabase();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase isn't configured." }, { status: 503 });
  }

  const doc = await supabase
    .from("studio_documents")
    .select("title, status, content, storage_path, sent_at, studio_clients(name)")
    .eq("id", params.id)
    .maybeSingle();
  if (!doc.data) return NextResponse.json({ error: "No such document." }, { status: 404 });

  if (doc.data.status !== "draft" && doc.data.storage_path) {
    const signed = await supabase.storage
      .from(STUDIO_BUCKET)
      .createSignedUrl(doc.data.storage_path, 60);
    if (signed.data?.signedUrl) return NextResponse.redirect(signed.data.signedUrl, 302);
  }

  if (!doc.data.content) {
    return NextResponse.json({ error: "Nothing to render." }, { status: 404 });
  }

  const buffer = await renderToBuffer(
    createElement(DocPdf, {
      title: doc.data.title,
      clientName: (doc.data.studio_clients as { name?: string } | null)?.name ?? null,
      dateLine: dateFmt.format(doc.data.sent_at ? new Date(doc.data.sent_at) : new Date()),
      content: doc.data.content as DocContent,
    }) as Parameters<typeof renderToBuffer>[0]
  );

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `inline; filename="${doc.data.title.replace(/[^\w .-]/g, "")}.pdf"`,
      "cache-control": "no-store",
    },
  });
}
