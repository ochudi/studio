import { clsx } from "clsx";

/** Hairline chip for statuses and flags. `filled` inverts it for emphasis. */
export default function Chip({
  children,
  filled = false,
  className,
}: {
  children: React.ReactNode;
  filled?: boolean;
  className?: string;
}) {
  return (
    <span
      className={clsx(
        "inline-flex items-center whitespace-nowrap rounded-full border px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.16em]",
        filled ? "border-fg bg-fg text-bg" : "border-line text-muted",
        className
      )}
    >
      {children}
    </span>
  );
}
