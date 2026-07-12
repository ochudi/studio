import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getSupabase } from "@/lib/supabase";
import type { DocContent } from "@/lib/doc-blocks";
import PageHeader from "@/components/PageHeader";
import DocEditor from "@/components/DocEditor";

export const metadata: Metadata = { title: "Edit document" };
export const dynamic = "force-dynamic";

export default async function EditDocumentPage({ params }: { params: { id: string } }) {
  const supabase = getSupabase();
  if (!supabase) notFound();

  const doc = (
    await supabase
      .from("studio_documents")
      .select("id, title, status, content")
      .eq("id", params.id)
      .maybeSingle()
  ).data;
  if (!doc || !doc.content) notFound();
  if (doc.status !== "draft") redirect(`/documents/${doc.id}`);

  return (
    <div>
      <PageHeader
        kicker="Documents"
        title="Editing"
        sub="Blocks, in the order they'll read. Save renders the same words to screen, PDF and DOCX."
      />
      <div className="px-6 py-8 md:px-10">
        <DocEditor
          endpoint={`/api/documents/${doc.id}`}
          initialTitle={doc.title}
          titleLabel="title"
          content={doc.content as DocContent}
          backHref={`/documents/${doc.id}`}
        />
      </div>
    </div>
  );
}
