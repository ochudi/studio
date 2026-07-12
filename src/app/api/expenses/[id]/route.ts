import { NextRequest, NextResponse } from "next/server";
import { getSupabase, STUDIO_BUCKET } from "@/lib/supabase";

export const runtime = "nodejs";

/** Deleting an expense takes its receipt (row and stored file) with it. */
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = getSupabase();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase isn't configured." }, { status: 503 });
  }

  const { data, error } = await supabase
    .from("studio_expenses")
    .delete()
    .eq("id", params.id)
    .select("receipt_document_id");
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data || data.length === 0) {
    return NextResponse.json({ error: "No such expense." }, { status: 404 });
  }

  const docId = data[0].receipt_document_id;
  if (docId) {
    const doc = await supabase
      .from("studio_documents")
      .delete()
      .eq("id", docId)
      .select("storage_path")
      .maybeSingle();
    if (doc.data?.storage_path) {
      await supabase.storage.from(STUDIO_BUCKET).remove([doc.data.storage_path]);
    }
  }

  return NextResponse.json({ ok: true });
}
