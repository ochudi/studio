import { NextRequest, NextResponse } from "next/server";
import { getSupabase, STUDIO_BUCKET } from "@/lib/supabase";

export const runtime = "nodejs";

const ALLOWED: Record<string, string> = {
  "image/webp": "webp",
  "image/jpeg": "jpg",
  "image/png": "png",
  "application/pdf": "pdf",
};
const MAX_BYTES = 25 * 1024 * 1024; // mirrors the bucket's per-file cap

/**
 * Receipt intake: the browser has already compressed screenshots to WebP;
 * this stores the bytes in the private bucket and files a document row the
 * expense will point at. Nothing here is ever publicly reachable — viewing
 * goes through short-lived signed URLs.
 */
export async function POST(req: NextRequest) {
  const supabase = getSupabase();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase isn't configured." }, { status: 503 });
  }

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file arrived." }, { status: 400 });
  }
  const ext = ALLOWED[file.type];
  if (!ext) {
    return NextResponse.json(
      { error: "Receipts are images or PDFs. That file is neither." },
      { status: 400 }
    );
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "That file is over the 25 MB cap." }, { status: 400 });
  }

  const projectId = form?.get("project_id");
  const title = String(form?.get("title") ?? "Receipt");

  const stamp = new Date().toISOString().slice(0, 7); // YYYY-MM folders
  const path = `receipts/${stamp}/${crypto.randomUUID()}.${ext}`;
  const bytes = Buffer.from(await file.arrayBuffer());

  const upload = await supabase.storage
    .from(STUDIO_BUCKET)
    .upload(path, bytes, { contentType: file.type });
  if (upload.error) {
    return NextResponse.json({ error: upload.error.message }, { status: 500 });
  }

  const { data, error } = await supabase
    .from("studio_documents")
    .insert({
      kind: "receipt",
      source: "uploaded",
      title,
      project_id: typeof projectId === "string" && projectId ? projectId : null,
      storage_path: path,
      mime_type: file.type,
      size_bytes: file.size,
    })
    .select("id")
    .single();
  if (error) {
    await supabase.storage.from(STUDIO_BUCKET).remove([path]);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ document_id: data.id }, { status: 201 });
}
