/**
 * Third renderer of the shared block model (web preview, PDF, this DOCX),
 * mirroring the PDF's monochrome editorial look in Word's own document
 * model. Fonts here are name references, not embeds — DOCX can't carry
 * font files, so Word falls back to its own sans/serif if Inter, Fraunces
 * or JetBrains Mono aren't installed on the reading machine.
 */

import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  LevelFormat,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
  convertInchesToTwip,
} from "docx";
import type { DocContent, PricingBlock } from "@/lib/doc-blocks";
import { paragraphs, pricingTotal } from "@/lib/doc-blocks";
import { formatMinor } from "@/lib/money";

const FONT_BODY = "Inter";
const FONT_MONO = "JetBrains Mono";
const FONT_DISPLAY = "Fraunces";
const INK = "111111";
const MUTED = "6F6F6F";
const BORDER = "E2E2E2";

function monoRun(text: string, opts: { size?: number; bold?: boolean; characterSpacing?: number } = {}): TextRun {
  return new TextRun({
    text,
    font: FONT_MONO,
    size: opts.size ?? 14,
    color: MUTED,
    bold: opts.bold,
    characterSpacing: opts.characterSpacing,
  });
}

function bodyRun(text: string, opts: { bold?: boolean; size?: number; color?: string } = {}): TextRun {
  return new TextRun({
    text,
    font: FONT_BODY,
    size: opts.size ?? 21,
    color: opts.color ?? INK,
    bold: opts.bold,
  });
}

function displayRun(text: string, opts: { size: number; bold?: boolean; color?: string }): TextRun {
  return new TextRun({
    text,
    font: FONT_DISPLAY,
    size: opts.size,
    bold: opts.bold ?? true,
    color: opts.color ?? INK,
  });
}

function pricingTable(block: PricingBlock): Table {
  const borders = {
    top: { style: BorderStyle.NONE, size: 0, color: BORDER },
    left: { style: BorderStyle.NONE, size: 0, color: BORDER },
    right: { style: BorderStyle.NONE, size: 0, color: BORDER },
    insideVertical: { style: BorderStyle.NONE, size: 0, color: BORDER },
    insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: BORDER },
    bottom: { style: BorderStyle.SINGLE, size: 4, color: BORDER },
  };

  const headerRow = new TableRow({
    children: [
      new TableCell({
        width: { size: 70, type: WidthType.PERCENTAGE },
        children: [new Paragraph({ children: [monoRun("PHASE")] })],
      }),
      new TableCell({
        width: { size: 30, type: WidthType.PERCENTAGE },
        children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [monoRun("AMOUNT")] })],
      }),
    ],
  });

  const bodyRows = block.rows.map((row) => {
    const firstCellChildren: Paragraph[] = [new Paragraph({ children: [bodyRun(row.label, { bold: true })] })];
    if (row.detail) {
      firstCellChildren.push(new Paragraph({ children: [bodyRun(row.detail, { size: 18, color: MUTED })] }));
    }
    const amountText =
      row.amount_minor != null ? formatMinor(row.amount_minor, block.currency) : "On scoping";
    const amountColor = row.amount_minor != null ? INK : MUTED;

    return new TableRow({
      children: [
        new TableCell({
          width: { size: 70, type: WidthType.PERCENTAGE },
          children: firstCellChildren,
        }),
        new TableCell({
          width: { size: 30, type: WidthType.PERCENTAGE },
          children: [
            new Paragraph({ alignment: AlignmentType.RIGHT, children: [bodyRun(amountText, { color: amountColor })] }),
          ],
        }),
      ],
    });
  });

  const total = pricingTotal(block);
  const totalRows =
    total != null
      ? [
          new TableRow({
            children: [
              new TableCell({
                width: { size: 70, type: WidthType.PERCENTAGE },
                children: [new Paragraph({ children: [monoRun("TOTAL")] })],
              }),
              new TableCell({
                width: { size: 30, type: WidthType.PERCENTAGE },
                children: [
                  new Paragraph({
                    alignment: AlignmentType.RIGHT,
                    children: [displayRun(formatMinor(total, block.currency), { size: 26, bold: true })],
                  }),
                ],
              }),
            ],
          }),
        ]
      : [];

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders,
    rows: [headerRow, ...bodyRows, ...totalRows],
  });
}

export async function renderDocx(input: {
  title: string;
  clientName: string | null;
  dateLine: string;
  content: DocContent;
}): Promise<Buffer> {
  const questionsIndexes = input.content.blocks
    .map((block, index) => (block.type === "questions" ? index : -1))
    .filter((index) => index !== -1);

  const numberingConfig = questionsIndexes.map((index) => ({
    reference: `questions-${index}`,
    levels: [
      {
        level: 0,
        format: LevelFormat.DECIMAL,
        text: "%1.",
        alignment: AlignmentType.START,
      },
    ],
  }));

  const metaParts = [input.clientName, input.dateLine].filter((part): part is string => Boolean(part));

  const body: (Paragraph | Table)[] = [
    new Paragraph({ children: [monoRun("GREYFORM", { size: 14, characterSpacing: 20 })] }),
    new Paragraph({
      spacing: { before: 200, after: 80 },
      children: [displayRun(input.title, { size: 56, bold: true })],
    }),
    new Paragraph({
      spacing: { after: 400 },
      children: [monoRun(metaParts.join("  ·  "), { size: 14 })],
    }),
  ];

  input.content.blocks.forEach((block, index) => {
    switch (block.type) {
      case "heading":
        body.push(
          new Paragraph({
            spacing: { before: 400, after: 120 },
            children: [displayRun(block.text, { size: 30, bold: true })],
          }),
        );
        break;
      case "text":
        for (const paragraph of paragraphs(block.text)) {
          body.push(new Paragraph({ spacing: { after: 160 }, children: [bodyRun(paragraph)] }));
        }
        break;
      case "list":
        for (const item of block.items.filter(Boolean)) {
          body.push(new Paragraph({ bullet: { level: 0 }, children: [bodyRun(item)] }));
        }
        break;
      case "questions":
        for (const item of block.items.filter(Boolean)) {
          body.push(
            new Paragraph({
              numbering: { reference: `questions-${index}`, level: 0 },
              children: [bodyRun(item)],
            }),
          );
        }
        break;
      case "pricing":
        body.push(pricingTable(block));
        break;
      case "signatures":
        for (const party of block.parties) {
          body.push(
            new Paragraph({ spacing: { before: 600 }, children: [monoRun("______________________________", { size: 14 })] }),
          );
          body.push(new Paragraph({ children: [monoRun(party.label, { size: 14 })] }));
          if (party.name) {
            body.push(new Paragraph({ children: [bodyRun(party.name, { bold: true })] }));
          }
        }
        break;
    }
  });

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: { font: FONT_BODY, size: 21, color: INK },
          paragraph: { spacing: { line: 320 } },
        },
      },
    },
    numbering: { config: numberingConfig },
    sections: [
      {
        properties: {
          page: {
            size: { width: 11906, height: 16838 },
            margin: {
              top: convertInchesToTwip(1),
              bottom: convertInchesToTwip(1),
              left: convertInchesToTwip(1),
              right: convertInchesToTwip(1),
            },
          },
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [monoRun("Greyform · greyform.org", { size: 14 })],
              }),
            ],
          }),
        },
        children: body,
      },
    ],
  });

  return Packer.toBuffer(doc);
}
