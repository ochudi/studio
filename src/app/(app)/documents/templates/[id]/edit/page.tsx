import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSupabase } from "@/lib/supabase";
import { DOC_KINDS, labelFor } from "@/lib/domain";
import type { DocContent } from "@/lib/doc-blocks";
import PageHeader from "@/components/PageHeader";
import DocEditor from "@/components/DocEditor";

export const metadata: Metadata = { title: "Edit template" };
export const dynamic = "force-dynamic";

export default async function EditTemplatePage({ params }: { params: { id: string } }) {
  const supabase = getSupabase();
  if (!supabase) notFound();

  const tpl = (
    await supabase
      .from("studio_doc_templates")
      .select("id, kind, name, content")
      .eq("id", params.id)
      .maybeSingle()
  ).data;
  if (!tpl || !tpl.content) notFound();

  return (
    <div>
      <PageHeader
        kicker={`Master · ${labelFor(DOC_KINDS, tpl.kind)}`}
        title="Editing the master"
        sub="Every future document made from this master inherits these blocks. Documents already created keep the words they were born with."
      />
      <div className="px-6 py-8 md:px-10">
        <DocEditor
          endpoint={`/api/templates/${tpl.id}`}
          initialTitle={tpl.name}
          titleLabel="name"
          content={tpl.content as DocContent}
          backHref="/documents"
        />
      </div>
    </div>
  );
}
