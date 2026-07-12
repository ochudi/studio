import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { formatMinor } from "@/lib/money";
import { paragraphs, pricingTotal, type DocContent, type DocBlock } from "@/lib/doc-blocks";
import { registerPdfFonts, PDF_INK, PDF_MUTED, PDF_LINE } from "@/lib/pdf-fonts";

/**
 * The PDF face of the document model. Same blocks as the web preview and
 * the DOCX, same three faces as everything else Greyform sends out.
 */

registerPdfFonts();

const s = StyleSheet.create({
  page: {
    paddingTop: 64,
    paddingBottom: 72,
    paddingHorizontal: 56,
    fontFamily: "Inter",
    fontWeight: 400,
    fontSize: 10.5,
    color: PDF_INK,
    lineHeight: 1.5,
  },
  mono: {
    fontFamily: "JetBrains Mono",
    fontSize: 7,
    letterSpacing: 1.6,
    textTransform: "uppercase",
    color: PDF_MUTED,
  },
  title: { fontFamily: "Fraunces", fontWeight: 600, fontSize: 26, lineHeight: 1.1, marginTop: 14 },
  heading: { fontFamily: "Fraunces", fontWeight: 600, fontSize: 14, marginTop: 22, marginBottom: 6 },
  para: { marginBottom: 8 },
  listRow: { flexDirection: "row", marginBottom: 5 },
  bullet: { width: 14, color: PDF_MUTED },
  qNum: { width: 22, fontFamily: "JetBrains Mono", fontSize: 8.5, color: PDF_MUTED, paddingTop: 1 },
  rule: { borderBottomWidth: 0.75, borderBottomColor: PDF_LINE },
  priceRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 9 },
  footer: {
    position: "absolute",
    left: 56,
    right: 56,
    bottom: 40,
    paddingTop: 10,
    borderTopWidth: 0.75,
    borderTopColor: PDF_LINE,
    flexDirection: "row",
    justifyContent: "space-between",
  },
});

function Block({ block }: { block: DocBlock }) {
  switch (block.type) {
    case "heading":
      return <Text style={s.heading}>{block.text}</Text>;
    case "text":
      return (
        <View>
          {paragraphs(block.text).map((p, i) => (
            <Text key={i} style={s.para}>
              {p}
            </Text>
          ))}
        </View>
      );
    case "list":
      return (
        <View style={{ marginBottom: 6 }}>
          {block.items.filter(Boolean).map((item, i) => (
            <View key={i} style={s.listRow}>
              <Text style={s.bullet}>·</Text>
              <Text style={{ flex: 1 }}>{item}</Text>
            </View>
          ))}
        </View>
      );
    case "questions":
      return (
        <View style={{ marginBottom: 6 }}>
          {block.items.filter(Boolean).map((item, i) => (
            <View key={i} style={s.listRow}>
              <Text style={s.qNum}>{String(i + 1).padStart(2, "0")}</Text>
              <Text style={{ flex: 1 }}>{item}</Text>
            </View>
          ))}
        </View>
      );
    case "pricing": {
      const total = pricingTotal(block);
      return (
        <View style={{ marginTop: 4, marginBottom: 8 }}>
          {block.rows.map((row, i) => (
            <View key={i} style={[s.priceRow, s.rule, i === 0 ? { borderTopWidth: 0.75, borderTopColor: PDF_LINE } : {}]} wrap={false}>
              <View style={{ flex: 1, paddingRight: 20 }}>
                <Text style={{ fontWeight: 600 }}>{row.label}</Text>
                {row.detail ? (
                  <Text style={{ fontSize: 9, color: PDF_MUTED, marginTop: 2 }}>{row.detail}</Text>
                ) : null}
              </View>
              <Text style={row.amount_minor == null ? { color: PDF_MUTED } : {}}>
                {row.amount_minor == null ? "On scoping" : formatMinor(row.amount_minor, block.currency)}
              </Text>
            </View>
          ))}
          {total != null && (
            <View style={[s.priceRow, { borderBottomWidth: 0.75, borderBottomColor: PDF_INK }]} wrap={false}>
              <Text style={s.mono}>Total</Text>
              <Text style={{ fontFamily: "Fraunces", fontWeight: 600, fontSize: 15 }}>
                {formatMinor(total, block.currency)}
              </Text>
            </View>
          )}
        </View>
      );
    }
    case "signatures":
      return (
        <View style={{ marginTop: 28 }}>
          {block.parties.map((party, i) => (
            <View key={i} style={{ marginBottom: 26 }} wrap={false}>
              <Text style={{ color: PDF_MUTED }}>______________________________</Text>
              <Text style={[s.mono, { marginTop: 5 }]}>{party.label}</Text>
              {party.name ? <Text style={{ fontWeight: 600, marginTop: 2 }}>{party.name}</Text> : null}
            </View>
          ))}
        </View>
      );
  }
}

export function DocPdf({
  title,
  clientName,
  dateLine,
  content,
}: {
  title: string;
  clientName: string | null;
  dateLine: string;
  content: DocContent;
}) {
  return (
    <Document title={`${title} · Greyform`} author="Greyform" creator="Greyform Studio" producer="Greyform Studio">
      <Page size="A4" style={s.page}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" }}>
          <Text style={s.mono}>Greyform</Text>
          <Text style={s.mono}>{dateLine}</Text>
        </View>
        <View style={[s.rule, { marginTop: 12 }]} />
        <Text style={s.title}>{title}</Text>
        {clientName && (
          <Text style={[s.mono, { marginTop: 8 }]}>Prepared for {clientName}</Text>
        )}
        <View style={{ marginTop: 14 }}>
          {content.blocks.map((block, i) => (
            <Block key={i} block={block} />
          ))}
        </View>
        <View style={s.footer} fixed>
          <Text style={s.mono}>Greyform · greyform.org</Text>
          <Text
            style={s.mono}
            render={({ pageNumber, totalPages }) =>
              totalPages > 1 ? `${pageNumber} / ${totalPages}` : ""
            }
          />
        </View>
      </Page>
    </Document>
  );
}
