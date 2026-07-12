import { NextRequest, NextResponse } from "next/server";
import { getSupabase, STUDIO_BUCKET } from "@/lib/supabase";

export const runtime = "nodejs";

const ALLOWED: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

/**
 * The client-signed scan, stored against the exact version they signed:
 * the original keeps its frozen as-sent copy, the scan lands as its own
 * signed_contract row pointing back via content.signed_of.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = getSupabase();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase isn't configured." }, { status: 503 });
  }

  const original = await supabase
    .from("studio_documents")
    .select("title, status, client_id, project_id")
    .eq("id", params.id)
    .maybeSingle();
  if (!original.data) return NextResponse.json({ error: "No such document." }, { status: 404 });
  if (original.data.status !== "sent") {
    return NextResponse.json(
      { error: "Send the document first; the scan signs what went out." },
      { status: 400 }
    );
  }

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file arrived." }, { status: 400 });
  }
  const ext = ALLOWED[file.type];
  if (!ext) {
    return NextResponse.json({ error: "Signed copies are PDFs or images." }, { status: 400 });
  }
  if (file.size > 25 * 1024 * 1024) {
    return NextResponse.json({ error: "That file is over the 25 MB cap." }, { status: 400 });
  }

  const path = `documents/${params.id}/signed-${crypto.randomUUID()}.${ext}`;
  const upload = await supabase.storage
    .from(STUDIO_BUCKET)
    .upload(path, Buffer.from(await file.arrayBuffer()), { contentType: file.type });
  if (upload.error) {
    return NextResponse.json({ error: upload.error.message }, { status: 500 });
  }

  const now = new Date().toISOString();
  const inserted = await supabase.from("studio_documents").insert({
    kind: "signed_contract",
    source: "uploaded",
    title: `Signed · ${original.data.title}`,
    client_id: original.data.client_id,
    project_id: original.data.project_id,
    content: { signed_of: params.id },
    status: "signed",
    signed_at: now,
    storage_path: path,
    mime_type: file.type,
    size_bytes: file.size,
  });
  if (inserted.error) {
    await supabase.storage.from(STUDIO_BUCKET).remove([path]);
    return NextResponse.json({ error: inserted.error.message }, { status: 500 });
  }

  const { error } = await supabase
    .from("studio_documents")
    .update({ status: "signed", signed_at: now, updated_at: now })
    .eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true }, { status: 201 });
}
