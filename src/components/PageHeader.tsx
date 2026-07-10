export default function PageHeader({
  kicker,
  title,
  sub,
  children,
}: {
  kicker: string;
  title: string;
  sub?: string;
  children?: React.ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-6 border-b border-line px-6 pb-6 pt-8 md:px-10 md:pt-10">
      <div>
        <p className="font-mono text-fluid-xs uppercase tracking-[0.18em] text-muted">
          {kicker}
        </p>
        <h1 className="mt-2 font-display tracking-tightest text-fluid-2xl leading-[1.05]">
          {title}
        </h1>
        {sub && (
          <p className="mt-2 max-w-[52ch] text-fluid-sm leading-relaxed text-muted">
            {sub}
          </p>
        )}
      </div>
      {children && <div className="flex items-center gap-3">{children}</div>}
    </header>
  );
}
