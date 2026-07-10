export default function EmptyState({
  title,
  body,
}: {
  title: string;
  body?: string;
}) {
  return (
    <div className="flex flex-col items-start gap-2 rounded-lg border border-dashed border-line px-6 py-10">
      <p className="text-fluid-base text-fg/85">{title}</p>
      {body && <p className="max-w-[48ch] text-fluid-sm leading-relaxed text-muted">{body}</p>}
    </div>
  );
}
