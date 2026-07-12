import { NextRequest, NextResponse } from "next/server";
import { getSupabase, STUDIO_BUCKET } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** View a receipt: a 60-second signed URL, minted per click. */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = getSupabase();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase isn't configured." }, { status: 503 });
  }

  const doc = await supabase
    .from("studio_documents")
    .select("storage_path")
    .eq("id", params.id)
    .maybeSingle();
  if (!doc.data?.storage_path) {
    return NextResponse.json({ error: "No such receipt." }, { status: 404 });
  }

  const signed = await supabase.storage
    .from(STUDIO_BUCKET)
    .createSignedUrl(doc.data.storage_path, 60);
  if (signed.error || !signed.data?.signedUrl) {
    return NextResponse.json(
      { error: signed.error?.message ?? "Couldn't sign the URL." },
      { status: 500 }
    );
  }

  return NextResponse.redirect(signed.data.signedUrl, 302);
}
