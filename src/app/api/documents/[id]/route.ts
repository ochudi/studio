import { createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createElement } from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { getSupabase, STUDIO_BUCKET } from "@/lib/supabase";
import { documentEditSchema } from "@/lib/domain";
import { DocPdf } from "@/lib/doc-pdf";
import type { DocContent } from "@/lib/doc-blocks";

export const runtime = "nodejs";

const TRANSITIONS: Record<string, string[]> = {
  draft: ["sent", "archived"],
  sent: ["signed", "archived"],
  signed: ["archived"],
  archived: [],
};

const statusSchema = z.object({ status: z.enum(["sent", "signed", "archived"]) });

const dateFmt = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "Africa/Lagos",
});

/**
 * `{ status }` walks the lifecycle; anything else edits a draft. Marking
 * sent freezes the exact PDF that went out into the bucket under a
 * content-hash filename — the record the client holds, forever fetchable.
 */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = getSupabase();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase isn't configured." }, { status: 503 });
  }

  const body = await req.json().catch(() => null);

  if (body && typeof body === "object" && "status" in body && Object.keys(body).length === 1) {
    const parsed = statusSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "That isn't a move a document makes." }, { status: 400 });
    }

    const current = await supabase
      .from("studio_documents")
      .select("status, title, content, studio_clients(name)")
      .eq("id", params.id)
      .maybeSingle();
    if (!current.data) return NextResponse.json({ error: "No such document." }, { status: 404 });
    if (!TRANSITIONS[current.data.status]?.includes(parsed.data.status)) {
      return NextResponse.json(
        { error: `A document can't go from ${current.data.status} to ${parsed.data.status}.` },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();
    const patch: Record<string, unknown> = { status: parsed.data.status, updated_at: now };
    if (parsed.data.status === "sent") {
      patch.sent_at = now;
      const buffer = await renderToBuffer(
        createElement(DocPdf, {
          title: current.data.title,
          clientName:
            (current.data.studio_clients as { name?: string } | null)?.name ?? null,
          dateLine: dateFmt.format(new Date()),
          content: current.data.content as DocContent,
        }) as Parameters<typeof renderToBuffer>[0]
      );
      const hash = createHash("sha256")
        .update(JSON.stringify(current.data.content))
        .digest("hex")
        .slice(0, 16);
      const path = `documents/${params.id}/${hash}.pdf`;
      const upload = await supabase.storage
        .from(STUDIO_BUCKET)
        .upload(path, buffer, { contentType: "application/pdf", upsert: true });
      if (upload.error) {
        return NextResponse.json(
          { error: `The as-sent copy didn't freeze: ${upload.error.message}` },
          { status: 500 }
        );
      }
      patch.storage_path = path;
      patch.mime_type = "application/pdf";
      patch.size_bytes = buffer.length;
    }
    if (parsed.data.status === "signed") patch.signed_at = now;

    const { error } = await supabase.from("studio_documents").update(patch).eq("id", params.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  const parsed = documentEditSchema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return NextResponse.json({ error: first?.message ?? "Check the form." }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("studio_documents")
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq("id", params.id)
    .eq("status", "draft")
    .select("id");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data || data.length === 0) {
    return NextResponse.json(
      { error: "Only drafts can be edited. Duplicate a sent document to revise it." },
      { status: 400 }
    );
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = getSupabase();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase isn't configured." }, { status: 503 });
  }

  const { data, error } = await supabase
    .from("studio_documents")
    .delete()
    .eq("id", params.id)
    .eq("status", "draft")
    .select("id");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data || data.length === 0) {
    return NextResponse.json(
      { error: "Only drafts can be deleted. Archive anything that went out." },
      { status: 400 }
    );
  }
  return NextResponse.json({ ok: true });
}
