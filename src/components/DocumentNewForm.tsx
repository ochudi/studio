"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DOC_KINDS, labelFor } from "@/lib/domain";
import { TextField, SelectField, SubmitButton, FormError } from "@/components/fields";

/**
 * Three decisions and a title: start from a master (kind comes with it),
 * attach it to a client and maybe a project, then straight into the editor.
 */

export type TemplateOption = { id: string; kind: string; name: string };
export type DocClientOption = { value: string; label: string };
export type DocProjectOption = { id: string; client_id: string; name: string };

export default function DocumentNewForm({
  templates,
  clients,
  projects,
  presetClient,
  presetProject,
}: {
  templates: TemplateOption[];
  clients: DocClientOption[];
  projects: DocProjectOption[];
  presetClient?: string;
  presetProject?: string;
}) {
  const router = useRouter();
  const [templateId, setTemplateId] = useState(templates[0]?.id ?? "");
  const [kind, setKind] = useState(templates[0]?.kind ?? "proposal");
  const [title, setTitle] = useState("");
  const [clientId, setClientId] = useState(presetClient ?? "");
  const [projectId, setProjectId] = useState(presetProject ?? "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const templateOptions = [
    ...templates.map((t) => ({ value: t.id, label: `${t.name} · ${labelFor(DOC_KINDS, t.kind)}` })),
    { value: "", label: "Blank" },
  ];
  const clientOptions = [{ value: "", label: "No client yet" }, ...clients];
  const projectOptions = [
    { value: "", label: "No project" },
    ...projects.filter((p) => p.client_id === clientId).map((p) => ({ value: p.id, label: p.name })),
  ];

  function onTemplateChange(e: React.ChangeEvent<HTMLSelectElement>) {
    setTemplateId(e.target.value);
    const t = templates.find((tpl) => tpl.id === e.target.value);
    if (t) setKind(t.kind);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/documents", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          template_id: templateId || null,
          kind,
          title,
          client_id: clientId || null,
          project_id: projectId || null,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error ?? "That didn't save. Try again.");
        setBusy(false);
        return;
      }
      router.push(`/documents/${data.id}/edit`);
      router.refresh();
    } catch {
      setError("Network hiccup. Try again.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="max-w-2xl">
      <section className="grid grid-cols-1 gap-x-10 gap-y-7 sm:grid-cols-2">
        <SelectField
          id="doc-template"
          label="Start from"
          options={templateOptions}
          value={templateId}
          onChange={onTemplateChange}
        />
        {!templateId ? (
          <SelectField
            id="doc-kind"
            label="Kind"
            options={DOC_KINDS}
            value={kind}
            onChange={(e) => setKind(e.target.value)}
          />
        ) : (
          <div aria-hidden className="hidden sm:block" />
        )}
        <TextField
          id="doc-title"
          label="Title"
          placeholder="Proposal · Whitesands School website"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          className="sm:col-span-2"
        />
        <SelectField
          id="doc-client"
          label="Client"
          options={clientOptions}
          value={clientId}
          onChange={(e) => {
            setClientId(e.target.value);
            setProjectId("");
          }}
        />
        <SelectField
          id="doc-project"
          label="Project"
          options={projectOptions}
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
        />
      </section>

      <div className="mt-10 flex items-center gap-5">
        <SubmitButton busy={busy}>{busy ? "Creating" : "Draft it"}</SubmitButton>
        <FormError error={error} />
      </div>
    </form>
  );
}
