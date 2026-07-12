import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { formatMinor } from "@/lib/money";
import { invoiceTotals, lineAmount, paidMinor } from "@/lib/invoice";
import { registerPdfFonts, PDF_INK, PDF_MUTED, PDF_LINE } from "@/lib/pdf-fonts";
import type { Client, Invoice, InvoiceItem, Payment, PaymentDetail } from "@/lib/domain";

/**
 * The invoice as a client holds it: the same monochrome system as the app,
 * set in the same three faces. Vector output from @react-pdf/renderer —
 * sub-second, no Chromium.
 */

registerPdfFonts();

const INK = PDF_INK;
const MUTED = PDF_MUTED;
const LINE = PDF_LINE;

const s = StyleSheet.create({
  page: {
    paddingTop: 64,
    paddingBottom: 72,
    paddingHorizontal: 56,
    fontFamily: "Inter",
    fontWeight: 400,
    fontSize: 10,
    color: INK,
    lineHeight: 1.45,
  },
  mono: {
    fontFamily: "JetBrains Mono",
    fontSize: 7,
    letterSpacing: 1.6,
    textTransform: "uppercase",
    color: MUTED,
  },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" },
  wordmark: { flexDirection: "row", alignItems: "flex-end" },
  wordmarkText: { fontFamily: "Fraunces", fontWeight: 600, fontSize: 19, lineHeight: 1 },
  dot: { width: 4, height: 4, borderRadius: 2, backgroundColor: INK, marginLeft: 3, marginBottom: 2 },
  rule: { borderBottomWidth: 0.75, borderBottomColor: LINE },
  ruleInk: { borderBottomWidth: 0.75, borderBottomColor: INK },
  meta: { flexDirection: "row", justifyContent: "space-between", marginTop: 36 },
  metaRight: { width: 180 },
  metaRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 5 },
  name: { fontWeight: 600, fontSize: 11 },
  mutedText: { color: MUTED },
  th: { flexDirection: "row", paddingBottom: 7 },
  tr: { flexDirection: "row", paddingVertical: 11 },
  colItem: { flex: 1, paddingRight: 16 },
  colQty: { width: 42, textAlign: "right" },
  colUnit: { width: 84, textAlign: "right" },
  colAmount: { width: 92, textAlign: "right" },
  itemTitle: { fontWeight: 600 },
  itemDesc: { fontSize: 8.5, color: MUTED, marginTop: 2 },
  totals: { marginTop: 4, alignSelf: "flex-end", width: 264 },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginTop: 9,
  },
  totalDue: { fontFamily: "Fraunces", fontWeight: 600, fontSize: 19, lineHeight: 1 },
  block: { marginTop: 30 },
  blockBody: { marginTop: 7, fontSize: 9, lineHeight: 1.55 },
  footer: {
    position: "absolute",
    left: 56,
    right: 56,
    bottom: 40,
    paddingTop: 10,
    borderTopWidth: 0.75,
    borderTopColor: LINE,
    flexDirection: "row",
    justifyContent: "space-between",
  },
});

const dateFmt = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "Africa/Lagos",
});
const fmtDate = (d: string) => dateFmt.format(new Date(d + "T12:00:00Z"));

const pct = (n: number) =>
  Number(n).toLocaleString("en", { maximumFractionDigits: 2 });

function qty(n: number): string {
  return Number(n).toLocaleString("en", { maximumFractionDigits: 2 });
}

export type InvoicePdfData = {
  invoice: Invoice;
  items: InvoiceItem[];
  client: Client;
  payments: Payment[];
  paymentDetail: PaymentDetail | null;
  projectName: string | null;
};

export function InvoicePdf({ invoice: inv, items, client, payments, paymentDetail, projectName }: InvoicePdfData) {
  const totals = invoiceTotals(items, Number(inv.discount_pct), Number(inv.tax_pct));
  const paid = paidMinor(payments, inv.currency);
  const balance = Math.max(0, totals.total - paid);
  const money = (minor: number) => formatMinor(minor, inv.currency);

  const statusNote =
    inv.status === "draft"
      ? "Draft"
      : inv.status === "void"
        ? "Void"
        : inv.status === "written_off"
          ? "Written off"
          : inv.status === "paid"
            ? "Paid in full"
            : null;

  const clientLines = [client.company, client.email, client.location].filter(Boolean) as string[];

  return (
    <Document
      title={`${inv.number} · Greyform`}
      author="Greyform"
      creator="Greyform Studio"
      producer="Greyform Studio"
    >
      <Page size="A4" style={s.page}>
        <View style={s.header}>
          <View style={s.wordmark}>
            <Text style={s.wordmarkText}>Greyform</Text>
            <View style={s.dot} />
          </View>
          <Text style={s.mono}>
            Invoice · {inv.number}
            {statusNote ? ` · ${statusNote}` : ""}
          </Text>
        </View>
        <View style={[s.rule, { marginTop: 18 }]} />

        <View style={s.meta}>
          <View style={{ maxWidth: 250 }}>
            <Text style={s.mono}>Billed to</Text>
            <Text style={[s.name, { marginTop: 7 }]}>{client.name}</Text>
            {clientLines.map((line) => (
              <Text key={line} style={s.mutedText}>
                {line}
              </Text>
            ))}
          </View>
          <View style={s.metaRight}>
            <View style={s.metaRow}>
              <Text style={s.mono}>Issued</Text>
              <Text>{fmtDate(inv.issue_date)}</Text>
            </View>
            {inv.due_date && (
              <View style={s.metaRow}>
                <Text style={s.mono}>Due</Text>
                <Text>{fmtDate(inv.due_date)}</Text>
              </View>
            )}
            {projectName && (
              <View style={s.metaRow}>
                <Text style={s.mono}>Project</Text>
                <Text style={{ maxWidth: 118, textAlign: "right" }}>{projectName}</Text>
              </View>
            )}
          </View>
        </View>

        <View style={{ marginTop: 36 }}>
          <View style={[s.th, s.rule]}>
            <Text style={[s.mono, s.colItem]}>Item</Text>
            <Text style={[s.mono, s.colQty]}>Qty</Text>
            <Text style={[s.mono, s.colUnit]}>Unit</Text>
            <Text style={[s.mono, s.colAmount]}>Amount</Text>
          </View>
          {items.map((it) => (
            <View key={it.id} style={[s.tr, s.rule]} wrap={false}>
              <View style={s.colItem}>
                <Text style={s.itemTitle}>{it.title}</Text>
                {it.description && <Text style={s.itemDesc}>{it.description}</Text>}
              </View>
              <Text style={s.colQty}>{qty(it.quantity)}</Text>
              <Text style={s.colUnit}>{money(Number(it.unit_minor))}</Text>
              <Text style={s.colAmount}>{money(lineAmount(it))}</Text>
            </View>
          ))}
        </View>

        <View style={s.totals} wrap={false}>
          {(totals.discountMinor > 0 || totals.taxMinor > 0) && (
            <View style={s.totalRow}>
              <Text style={s.mono}>Subtotal</Text>
              <Text>{money(totals.gross)}</Text>
            </View>
          )}
          {totals.discountMinor > 0 && (
            <View style={s.totalRow}>
              <Text style={s.mono}>
                {inv.discount_label ?? "Courtesy"}, less {pct(inv.discount_pct)}%
              </Text>
              <Text>−{money(totals.discountMinor)}</Text>
            </View>
          )}
          {totals.taxMinor > 0 && (
            <View style={s.totalRow}>
              <Text style={s.mono}>Tax · {pct(inv.tax_pct)}%</Text>
              <Text>{money(totals.taxMinor)}</Text>
            </View>
          )}
          {paid > 0 && (
            <>
              <View style={s.totalRow}>
                <Text style={s.mono}>Total</Text>
                <Text>{money(totals.total)}</Text>
              </View>
              <View style={s.totalRow}>
                <Text style={s.mono}>Paid to date</Text>
                <Text>−{money(paid)}</Text>
              </View>
            </>
          )}
          <View style={[s.ruleInk, { marginTop: 12 }]} />
          <View style={s.totalRow}>
            <Text style={s.mono}>{paid > 0 ? "Balance due" : "Total due"}</Text>
            <Text style={s.totalDue}>{money(paid > 0 ? balance : totals.total)}</Text>
          </View>
        </View>

        {paymentDetail && balance > 0 && inv.status !== "void" && inv.status !== "written_off" && (
          <View style={s.block} wrap={false}>
            <Text style={s.mono}>How to pay · {paymentDetail.label}</Text>
            <View style={s.blockBody}>
              {paymentDetail.lines.map((line) => (
                <Text key={line}>{line}</Text>
              ))}
            </View>
          </View>
        )}

        {inv.notes && (
          <View style={s.block} wrap={false}>
            <Text style={s.mono}>Notes</Text>
            <Text style={[s.blockBody, s.mutedText]}>{inv.notes}</Text>
          </View>
        )}

        {inv.terms && (
          <View style={s.block} wrap={false}>
            <Text style={s.mono}>Terms</Text>
            <Text style={[s.blockBody, s.mutedText]}>{inv.terms}</Text>
          </View>
        )}

        <View style={s.footer} fixed>
          <Text style={s.mono}>Greyform · greyform.org</Text>
          <Text style={s.mono}>Thank you</Text>
        </View>
      </Page>
    </Document>
  );
}
