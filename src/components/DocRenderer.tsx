import { formatMinor } from "@/lib/money";
import { paragraphs, pricingTotal, type DocContent, type DocBlock } from "@/lib/doc-blocks";

/**
 * The on-screen face of the document model. Same blocks, same order, same
 * words as the PDF and the DOCX; if it reads right here it goes out right.
 */

function Block({ block }: { block: DocBlock }) {
  switch (block.type) {
    case "heading":
      return (
        <h2 className="mt-10 font-display text-fluid-lg tracking-tightest first:mt-0">
          {block.text}
        </h2>
      );
    case "text":
      return (
        <>
          {paragraphs(block.text).map((p, i) => (
            <p key={i} className="mt-4 text-fluid-sm leading-relaxed first:mt-3">
              {p}
            </p>
          ))}
        </>
      );
    case "list":
      return (
        <ul className="mt-4 space-y-2">
          {block.items.filter(Boolean).map((item, i) => (
            <li key={i} className="flex gap-3 text-fluid-sm leading-relaxed">
              <span aria-hidden className="text-muted">·</span>
              <span className="min-w-0">{item}</span>
            </li>
          ))}
        </ul>
      );
    case "questions":
      return (
        <ol className="mt-4 space-y-3">
          {block.items.filter(Boolean).map((item, i) => (
            <li key={i} className="flex gap-4 text-fluid-sm leading-relaxed">
              <span className="tnum pt-0.5 font-mono text-[10px] tracking-[0.16em] text-muted">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="min-w-0">{item}</span>
            </li>
          ))}
        </ol>
      );
    case "pricing": {
      const total = pricingTotal(block);
      return (
        <div className="mt-5">
          <ul className="divide-y divide-line border-y border-line">
            {block.rows.map((row, i) => (
              <li key={i} className="flex items-baseline justify-between gap-6 py-3.5">
                <div className="min-w-0">
                  <p className="text-fluid-sm">{row.label}</p>
                  {row.detail && (
                    <p className="mt-0.5 max-w-[52ch] text-fluid-xs leading-relaxed text-muted">
                      {row.detail}
                    </p>
                  )}
                </div>
                <p className={`tnum whitespace-nowrap text-fluid-sm ${row.amount_minor == null ? "text-muted" : ""}`}>
                  {row.amount_minor == null ? "On scoping" : formatMinor(row.amount_minor, block.currency)}
                </p>
              </li>
            ))}
          </ul>
          {total != null && (
            <div className="flex items-baseline justify-between gap-6 border-b border-fg py-3.5">
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted">Total</p>
              <p className="tnum whitespace-nowrap font-display text-fluid-xl tracking-tightest">
                {formatMinor(total, block.currency)}
              </p>
            </div>
          )}
        </div>
      );
    }
    case "signatures":
      return (
        <div className="mt-12 grid grid-cols-1 gap-10 sm:grid-cols-2">
          {block.parties.map((party, i) => (
            <div key={i}>
              <div className="w-56 max-w-full border-b border-fg pb-10" />
              <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
                {party.label}
              </p>
              {party.name && <p className="mt-1 text-fluid-sm">{party.name}</p>}
            </div>
          ))}
        </div>
      );
  }
}

export default function DocRenderer({ content }: { content: DocContent }) {
  return (
    <div className="max-w-[72ch]">
      {content.blocks.map((block, i) => (
        <Block key={i} block={block} />
      ))}
    </div>
  );
}
