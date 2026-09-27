/**
 * Quote and invoice PDF rendering.
 *
 * Both `/pdf` routes used to return an HTML page with a `window.print()` button,
 * which meant "download the PDF" produced a web page, nothing could be attached to
 * an email, and every field was interpolated into markup unescaped. React-PDF
 * renders a real PDF server-side and escapes text by construction.
 *
 * One component serves both document types. A quote and an invoice differ only in
 * their title, whether the date beside the issue date is a validity or a due date,
 * and whether a payment summary and history appear at the end.
 */

import React from 'react';
import { Document, Page, Text, View, StyleSheet, renderToBuffer } from '@react-pdf/renderer';

export type PdfDocumentKind = 'quote' | 'invoice';

export interface PdfLineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  taxRate: number;
  total: number;
}

export interface PdfPayment {
  amount: number;
  paymentDate: Date | string;
  paymentMethod: string;
  referenceNumber?: string | null;
}

export interface PdfDocumentData {
  kind: PdfDocumentKind;
  /** `Q-2026-0001` or `INV-2026-0001`. */
  number: string;
  status: string;
  workspaceName: string;
  clientName: string;
  clientEmail?: string | null;
  clientPhone?: string | null;
  clientCompany?: string | null;
  clientAddress?: string | null;
  issueDate: Date | string;
  /** `validUntil` for a quote, `dueDate` for an invoice. */
  secondaryDate?: Date | string | null;
  currency: string;
  items: PdfLineItem[];
  subtotal: number;
  discountAmount: number;
  taxRate: number;
  taxAmount: number;
  total: number;
  /** Invoices only. */
  amountPaid?: number;
  amountDue?: number;
  payments?: PdfPayment[];
  notes?: string | null;
  terms?: string | null;
}

const COLORS = {
  ink: '#1a1a1a',
  muted: '#6b7280',
  faint: '#9ca3af',
  rule: '#e5e7eb',
  wash: '#f8fafc',
  accentQuote: '#065f46',
  accentInvoice: '#1e40af',
  due: '#b91c1c',
  paid: '#047857',
};

const styles = StyleSheet.create({
  page: { paddingTop: 44, paddingBottom: 56, paddingHorizontal: 44, fontSize: 10, color: COLORS.ink, fontFamily: 'Helvetica' },

  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 },
  title: { fontSize: 22, fontFamily: 'Helvetica-Bold' },
  workspace: { fontSize: 11, color: COLORS.muted, marginTop: 4 },
  statusPill: { fontSize: 8, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', letterSpacing: 0.6, color: '#fff', paddingVertical: 4, paddingHorizontal: 8, borderRadius: 3 },

  metaRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 26 },
  metaBlock: { width: '48%' },
  metaLabel: { fontSize: 8, color: COLORS.faint, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 5 },
  metaLine: { fontSize: 10, marginBottom: 2 },
  metaStrong: { fontSize: 11, fontFamily: 'Helvetica-Bold', marginBottom: 2 },

  tableHead: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: COLORS.ink, paddingBottom: 5, marginBottom: 2 },
  th: { fontSize: 8, color: COLORS.muted, textTransform: 'uppercase', letterSpacing: 0.6 },
  row: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: COLORS.rule, paddingVertical: 6 },

  // Shared column geometry so head and body stay aligned.
  colDesc: { width: '46%', paddingRight: 6 },
  colQty: { width: '10%', textAlign: 'right' },
  colPrice: { width: '16%', textAlign: 'right' },
  colAdj: { width: '12%', textAlign: 'right' },
  colTotal: { width: '16%', textAlign: 'right' },

  totals: { marginTop: 16, marginLeft: 'auto', width: '52%' },
  totalsRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  totalsLabel: { fontSize: 10, color: COLORS.muted },
  totalsValue: { fontSize: 10 },
  grandRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6, paddingTop: 7, borderTopWidth: 1, borderTopColor: COLORS.ink },
  grandLabel: { fontSize: 12, fontFamily: 'Helvetica-Bold' },
  grandValue: { fontSize: 13, fontFamily: 'Helvetica-Bold' },
  dueRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8, paddingTop: 7, borderTopWidth: 1, borderTopColor: COLORS.rule },

  section: { marginTop: 26 },
  sectionTitle: { fontSize: 9, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', letterSpacing: 0.6, color: COLORS.muted, marginBottom: 6 },
  body: { fontSize: 9, lineHeight: 1.5, color: '#374151' },

  footer: { position: 'absolute', bottom: 26, left: 44, right: 44, textAlign: 'center', fontSize: 8, color: COLORS.faint },
});

const STATUS_COLORS: Record<string, string> = {
  draft: '#6b7280',
  sent: '#2563eb',
  viewed: '#7c3aed',
  accepted: '#047857',
  rejected: '#b91c1c',
  expired: '#92400e',
  partially_paid: '#b45309',
  paid: '#047857',
  overdue: '#b91c1c',
  cancelled: '#6b7280',
};

function money(amount: number, currency: string): string {
  // `en-US` with an explicit currency, matching how amounts render in the app.
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount ?? 0);
}

function day(date: Date | string | null | undefined): string {
  if (!date) return '—';
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return '—';
  return parsed.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function statusLabel(status: string): string {
  return status.replace(/_/g, ' ');
}

export function DocumentPdf({ data }: { data: PdfDocumentData }) {
  const isInvoice = data.kind === 'invoice';
  const accent = isInvoice ? COLORS.accentInvoice : COLORS.accentQuote;
  const payments = data.payments ?? [];
  const amountPaid = data.amountPaid ?? 0;
  const amountDue = data.amountDue ?? 0;

  // Per-line adjustments only earn a column when some line actually uses one.
  const showAdjustments = data.items.some((item) => item.discount > 0 || item.taxRate > 0);

  return (
    <Document
      title={`${isInvoice ? 'Invoice' : 'Quote'} ${data.number}`}
      author={data.workspaceName}
    >
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>{isInvoice ? 'Invoice' : 'Quote'} {data.number}</Text>
            <Text style={styles.workspace}>{data.workspaceName}</Text>
          </View>
          <Text style={[styles.statusPill, { backgroundColor: STATUS_COLORS[data.status] ?? COLORS.muted }]}>
            {statusLabel(data.status)}
          </Text>
        </View>

        <View style={styles.metaRow}>
          <View style={styles.metaBlock}>
            <Text style={styles.metaLabel}>Billed to</Text>
            <Text style={styles.metaStrong}>{data.clientName}</Text>
            {data.clientCompany ? <Text style={styles.metaLine}>{data.clientCompany}</Text> : null}
            {data.clientEmail ? <Text style={styles.metaLine}>{data.clientEmail}</Text> : null}
            {data.clientPhone ? <Text style={styles.metaLine}>{data.clientPhone}</Text> : null}
            {data.clientAddress ? <Text style={styles.metaLine}>{data.clientAddress}</Text> : null}
          </View>
          <View style={styles.metaBlock}>
            <Text style={styles.metaLabel}>Details</Text>
            <Text style={styles.metaLine}>Issued {day(data.issueDate)}</Text>
            <Text style={styles.metaLine}>
              {isInvoice ? 'Due ' : 'Valid until '}
              {day(data.secondaryDate)}
            </Text>
            <Text style={styles.metaLine}>Currency {data.currency}</Text>
          </View>
        </View>

        <View style={styles.tableHead}>
          <Text style={[styles.th, styles.colDesc]}>Description</Text>
          <Text style={[styles.th, styles.colQty]}>Qty</Text>
          <Text style={[styles.th, styles.colPrice]}>Unit price</Text>
          {showAdjustments ? <Text style={[styles.th, styles.colAdj]}>Disc / Tax</Text> : null}
          <Text style={[styles.th, styles.colTotal]}>Amount</Text>
        </View>

        {data.items.map((item, index) => (
          <View key={index} style={styles.row} wrap={false}>
            <Text style={styles.colDesc}>{item.description || '—'}</Text>
            <Text style={styles.colQty}>{item.quantity}</Text>
            <Text style={styles.colPrice}>{money(item.unitPrice, data.currency)}</Text>
            {showAdjustments ? (
              <Text style={[styles.colAdj, { color: COLORS.muted }]}>
                {item.discount > 0 ? `-${item.discount}%` : '—'}
                {item.taxRate > 0 ? ` / ${item.taxRate}%` : ''}
              </Text>
            ) : null}
            <Text style={styles.colTotal}>{money(item.total, data.currency)}</Text>
          </View>
        ))}

        <View style={styles.totals}>
          <View style={styles.totalsRow}>
            <Text style={styles.totalsLabel}>Subtotal</Text>
            <Text style={styles.totalsValue}>{money(data.subtotal, data.currency)}</Text>
          </View>
          {data.discountAmount > 0 ? (
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>Discount</Text>
              <Text style={styles.totalsValue}>-{money(data.discountAmount, data.currency)}</Text>
            </View>
          ) : null}
          {data.taxAmount > 0 ? (
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>Tax</Text>
              <Text style={styles.totalsValue}>{money(data.taxAmount, data.currency)}</Text>
            </View>
          ) : null}
          <View style={styles.grandRow}>
            <Text style={styles.grandLabel}>Total</Text>
            <Text style={[styles.grandValue, { color: accent }]}>{money(data.total, data.currency)}</Text>
          </View>

          {/* Amount due always prints on an invoice. It used to be hidden entirely
              until a payment existed, so an unpaid invoice — the case where it
              matters most — showed no balance at all. */}
          {isInvoice ? (
            <>
              {amountPaid > 0 ? (
                <View style={styles.totalsRow}>
                  <Text style={styles.totalsLabel}>Amount paid</Text>
                  <Text style={[styles.totalsValue, { color: COLORS.paid }]}>
                    {money(amountPaid, data.currency)}
                  </Text>
                </View>
              ) : null}
              <View style={styles.dueRow}>
                <Text style={styles.grandLabel}>{amountDue > 0 ? 'Amount due' : 'Paid in full'}</Text>
                <Text style={[styles.grandValue, { color: amountDue > 0 ? COLORS.due : COLORS.paid }]}>
                  {money(amountDue, data.currency)}
                </Text>
              </View>
            </>
          ) : null}
        </View>

        {isInvoice && payments.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Payment history</Text>
            {payments.map((payment, index) => (
              <View key={index} style={styles.row} wrap={false}>
                <Text style={styles.colDesc}>
                  {day(payment.paymentDate)} · {statusLabel(payment.paymentMethod)}
                  {payment.referenceNumber ? ` · ${payment.referenceNumber}` : ''}
                </Text>
                <Text style={[styles.colTotal, { width: '54%' }]}>
                  {money(payment.amount, data.currency)}
                </Text>
              </View>
            ))}
          </View>
        ) : null}

        {data.notes ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Notes</Text>
            <Text style={styles.body}>{data.notes}</Text>
          </View>
        ) : null}

        {data.terms ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Terms</Text>
            <Text style={styles.body}>{data.terms}</Text>
          </View>
        ) : null}

        <Text
          style={styles.footer}
          render={({ pageNumber, totalPages }) =>
            `${data.workspaceName} · ${data.number} · Page ${pageNumber} of ${totalPages}`
          }
          fixed
        />
      </Page>
    </Document>
  );
}

/** Render a quote or invoice to a PDF buffer, ready to serve or attach to an email. */
export async function renderDocumentPdf(data: PdfDocumentData): Promise<Buffer> {
  return renderToBuffer(<DocumentPdf data={data} />);
}

/** `INV-2026-0001.pdf` — the filename a client sees when they save the attachment. */
export function pdfFilename(data: Pick<PdfDocumentData, 'number'>): string {
  return `${data.number.replace(/[^A-Za-z0-9._-]/g, '_')}.pdf`;
}
