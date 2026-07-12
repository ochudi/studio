/**
 * One document model, three renderers. Content lives as structured JSON —
 * these types are the contract between the web preview, the PDF and the
 * DOCX, so downloads always match the screen.
 */

export type HeadingBlock = { type: "heading"; text: string };
/** Body copy; blank lines split paragraphs at render time. */
export type TextBlock = { type: "text"; text: string };
export type ListBlock = { type: "list"; items: string[] };
/** Phased pricing for proposals. amount_minor null renders as "on scoping". */
export type PricingBlock = {
  type: "pricing";
  currency: string;
  rows: { label: string; detail: string; amount_minor: number | null }[];
};
/** Intake questionnaire; research says past 20 questions people abandon. */
export type QuestionsBlock = { type: "questions"; items: string[] };
export type SignaturesBlock = {
  type: "signatures";
  parties: { label: string; name: string }[];
};

export type DocBlock =
  | HeadingBlock
  | TextBlock
  | ListBlock
  | PricingBlock
  | QuestionsBlock
  | SignaturesBlock;

export type DocContent = { blocks: DocBlock[] };

export const BLOCK_TYPES = [
  { value: "heading", label: "Heading" },
  { value: "text", label: "Text" },
  { value: "list", label: "List" },
  { value: "pricing", label: "Pricing" },
  { value: "questions", label: "Questions" },
  { value: "signatures", label: "Signatures" },
] as const;

export function emptyBlock(type: DocBlock["type"]): DocBlock {
  switch (type) {
    case "heading":
      return { type, text: "" };
    case "text":
      return { type, text: "" };
    case "list":
      return { type, items: [""] };
    case "pricing":
      return { type, currency: "NGN", rows: [{ label: "", detail: "", amount_minor: null }] };
    case "questions":
      return { type, items: [""] };
    case "signatures":
      return {
        type,
        parties: [
          { label: "For Greyform", name: "Chudi Ofoma" },
          { label: "For the client", name: "" },
        ],
      };
  }
}

export function paragraphs(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}

/** Total of priced rows; null when nothing is priced yet. */
export function pricingTotal(block: PricingBlock): number | null {
  const priced = block.rows.filter((r) => r.amount_minor != null);
  if (priced.length === 0) return null;
  return priced.reduce((sum, r) => sum + Number(r.amount_minor), 0);
}
