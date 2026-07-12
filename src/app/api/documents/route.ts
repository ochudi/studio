import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { documentCreateSchema } from "@/lib/domain";

export const runtime = "nodejs";

/**
 * Create a draft: from a template (content copied at creation, so editing
 * the master later never rewrites history), as a duplicate of an existing
 * document (the revision path for anything already sent), or blank.
 */
export async function POST(req: NextRequest) {
  const supabase = getSupabase();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase isn't configured." }, { status: 503 });
  }

  const body = await req.json().catch(() => null);
  const parsed = documentCreateSchema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return NextResponse.json({ error: first?.message ?? "Check the form." }, { status: 400 });
  }

  const { template_id, duplicate_of, ...doc } = parsed.data;
  let content: unknown = { blocks: [{ type: "text", text: "" }] };

  if (duplicate_of) {
    const src = await supabase
      .from("studio_documents")
      .select("content")
      .eq("id", duplicate_of)
      .maybeSingle();
    if (!src.data) return NextResponse.json({ error: "No such document." }, { status: 404 });
    content = src.data.content ?? content;
  } else if (template_id) {
    const tpl = await supabase
      .from("studio_doc_templates")
      .select("content")
      .eq("id", template_id)
      .maybeSingle();
    if (!tpl.data) return NextResponse.json({ error: "No such template." }, { status: 404 });
    content = tpl.data.content ?? content;
  }

  const { data, error } = await supabase
    .from("studio_documents")
    .insert({
      ...doc,
      template_id: template_id ?? null,
      source: "generated",
      status: "draft",
      content,
    })
    .select("id")
    .single();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ id: data.id }, { status: 201 });
}
