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
 *
 * Black and white only (see pdf-theme), in the reader's language when the caller
 * passes a translator; English otherwise. Arabic is laid out right to left.
 */

import React from 'react';
import type { MessageKey } from '@/i18n/I18nProvider';
import type { ServerTranslate } from '@/i18n/server';
import en from '@/i18n/messages/en';
import { Document, Page, Text, View, StyleSheet, renderToBuffer } from '@react-pdf/renderer';
import { ARABIC, INK, pdfDay, pdfFaces, pdfMoney, registerArabicFont } from './pdf-theme';

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

/** The reader's language. Without it the document prints in English, as it always did. */
export interface PdfLanguage {
  t: ServerTranslate;
  /** Intl locale for numbers and dates, e.g. `fr` or `ar-u-nu-latn`. */
  locale: string;
  rtl?: boolean;
}

/** The English catalog, with `{name}` placeholders filled. */
const english: ServerTranslate = (key, values) => {
  const value = key.split('.').reduce<unknown>(
    (acc, part) => (acc && typeof acc === 'object' ? (acc as Record<string, unknown>)[part] : undefined),
    en
  );
  const text = typeof value === 'string' ? value : key;
  return values ? text.replace(/\{(\w+)\}/g, (match, name) => (name in values ? String(values[name]) : match)) : text;
};

/** The statuses worth printing on the document itself; the others are workflow, not news for the client. */
const PRINTED_STATUSES = new Set(['paid', 'partially_paid', 'cancelled']);

function makeStyles(rtl: boolean) {
  const { regular, bold } = pdfFaces(rtl);
  const row = rtl ? 'row-reverse' as const : 'row' as const;
  const start = rtl ? 'right' as const : 'left' as const;
  const end = rtl ? 'left' as const : 'right' as const;
  const dir = rtl ? { direction: 'rtl' as const } : {};
  const text = { textAlign: start, ...dir };
  const endText = { textAlign: end, ...dir };
  // Capitals and letter spacing break Arabic joining, so they are Latin-only.
  const caps = rtl ? {} : { textTransform: 'uppercase' as const, letterSpacing: 0.8 };
  return StyleSheet.create({
    page: { paddingTop: 48, paddingBottom: 60, paddingHorizontal: 52, fontSize: 10, color: INK.text, ...regular },
    text,

    header: { flexDirection: row, justifyContent: 'space-between', alignItems: 'flex-start', paddingBottom: 14, borderBottomWidth: 1.5, borderBottomColor: INK.text, marginBottom: 26 },
    issuer: { fontSize: 13, ...bold, ...text },
    docBlock: { alignItems: rtl ? 'flex-start' as const : 'flex-end' as const },
    title: { fontSize: 12, ...bold, ...(rtl ? {} : { textTransform: 'uppercase' as const, letterSpacing: 1.2 }), ...endText },
    number: { fontSize: 10, color: INK.muted, marginTop: 4, ...endText },
    // The border sits on a box around the text: a bordered right-to-left Text draws its border apart from its words.
    statusBox: { marginTop: 8, borderWidth: 1, borderColor: INK.text, paddingVertical: 3, paddingHorizontal: 7 },
    statusLabel: { fontSize: 8, ...bold, ...caps, textAlign: 'center' },

    metaRow: { flexDirection: row, justifyContent: 'space-between', marginBottom: 26 },
    metaBlock: { width: '48%' },
    metaLabel: { fontSize: 8, color: INK.faint, marginBottom: 5, ...caps, ...text },
    metaLine: { fontSize: 10, marginBottom: 2, ...text },
    metaStrong: { fontSize: 11, ...bold, marginBottom: 2, ...text },

    tableHead: { flexDirection: row, borderBottomWidth: 1, borderBottomColor: INK.text, paddingBottom: 5, marginBottom: 2 },
    th: { fontSize: 8, color: INK.muted, ...caps },
    row: { flexDirection: row, borderBottomWidth: 0.5, borderBottomColor: INK.rule, paddingVertical: 6 },

    // Shared column geometry so head and body stay aligned.
    // The description takes whatever the figures leave, so the table always spans
    // the page; the money columns are wide enough for a full amount on one line.
    colDesc: { flexGrow: 1, flexShrink: 1, flexBasis: 0, ...(rtl ? { paddingLeft: 8 } : { paddingRight: 8 }), ...text },
    colQty: { width: '7%', ...endText },
    colPrice: { width: '21%', ...endText },
    colAdj: { width: '13%', ...endText },
    colTotal: { width: '21%', ...endText },

    totals: { marginTop: 16, ...(rtl ? { marginRight: 'auto' } : { marginLeft: 'auto' }), width: '52%' },
    totalsRow: { flexDirection: row, justifyContent: 'space-between', paddingVertical: 3 },
    totalsLabel: { fontSize: 10, color: INK.muted, ...text },
    totalsValue: { fontSize: 10, ...endText },
    grandRow: { flexDirection: row, justifyContent: 'space-between', marginTop: 6, paddingTop: 7, borderTopWidth: 1, borderTopColor: INK.text },
    grandLabel: { fontSize: 12, ...bold, ...text },
    grandValue: { fontSize: 13, ...bold, ...endText },
    // What is still owed: the figure the reader came for, boxed by heavy rules rather than coloured.
    dueRow: { flexDirection: row, justifyContent: 'space-between', marginTop: 10, paddingVertical: 8, borderTopWidth: 1.5, borderBottomWidth: 1.5, borderColor: INK.text },

    section: { marginTop: 26 },
    sectionTitle: { fontSize: 8, ...bold, ...caps, color: INK.muted, marginBottom: 6, ...text },
    body: { fontSize: 9, lineHeight: 1.5, color: INK.text, ...text },

    footer: { position: 'absolute', bottom: 28, left: 52, right: 52, textAlign: 'center', fontSize: 8, color: INK.faint, ...dir },
  });
}

export function DocumentPdf({ data, language }: { data: PdfDocumentData; language?: PdfLanguage }) {
  const t = language?.t ?? english;
  const locale = language?.locale ?? 'en-US';
  const rtl = Boolean(language?.rtl);
  const styles = makeStyles(rtl);
  // On an Arabic document, Latin text (emails, numbers, references) keeps its own order.
  const own = (text: string) => (rtl && !ARABIC.test(text) ? { direction: 'ltr' as const } : {});
  const money = (n: number) => pdfMoney(locale, data.currency, n);
  const day = (d: Date | string | null | undefined) => pdfDay(locale, d);
  const method = (m: string) => {
    const label = t(`developerSales.collections.method_${m}` as MessageKey);
    return label.startsWith('developerSales.') ? m.replace(/_/g, ' ') : label;
  };

  const isInvoice = data.kind === 'invoice';
  const payments = data.payments ?? [];
  const amountPaid = data.amountPaid ?? 0;
  const amountDue = data.amountDue ?? 0;
  const title = t(isInvoice ? 'documentPdf.invoice' : 'documentPdf.quote');

  // Per-line adjustments only earn a column when some line actually uses one.
  const showAdjustments = data.items.some((item) => item.discount > 0 || item.taxRate > 0);

  return (
    <Document title={`${title} ${data.number}`} author={data.workspaceName} language={rtl ? 'ar' : undefined}>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={[styles.issuer, own(data.workspaceName)]}>{data.workspaceName}</Text>
          <View style={styles.docBlock}>
            <Text style={styles.title}>{title}</Text>
            <Text style={[styles.number, own(data.number)]}>{data.number}</Text>
            {isInvoice && PRINTED_STATUSES.has(data.status) ? (
              <View style={styles.statusBox}>
                <Text style={styles.statusLabel}>{t(`documentPdf.status_${data.status}` as MessageKey)}</Text>
              </View>
            ) : null}
          </View>
        </View>

        <View style={styles.metaRow}>
          <View style={styles.metaBlock}>
            <Text style={styles.metaLabel}>{t('documentPdf.billedTo')}</Text>
            <Text style={[styles.metaStrong, own(data.clientName)]}>{data.clientName}</Text>
            {data.clientCompany ? <Text style={[styles.metaLine, own(data.clientCompany)]}>{data.clientCompany}</Text> : null}
            {data.clientAddress ? <Text style={[styles.metaLine, own(data.clientAddress)]}>{data.clientAddress}</Text> : null}
            {data.clientPhone ? <Text style={[styles.metaLine, own(data.clientPhone)]}>{data.clientPhone}</Text> : null}
            {data.clientEmail ? <Text style={[styles.metaLine, own(data.clientEmail)]}>{data.clientEmail}</Text> : null}
          </View>
          <View style={styles.metaBlock}>
            <Text style={styles.metaLabel}>{t('documentPdf.details')}</Text>
            <Text style={styles.metaLine}>{t('documentPdf.issued', { date: day(data.issueDate) })}</Text>
            <Text style={styles.metaLine}>
              {t(isInvoice ? 'documentPdf.due' : 'documentPdf.validUntil', { date: day(data.secondaryDate) })}
            </Text>
            <Text style={styles.metaLine}>{t('documentPdf.currency', { currency: data.currency })}</Text>
          </View>
        </View>

        <View style={styles.tableHead}>
          <Text style={[styles.th, styles.colDesc]}>{t('documentPdf.description')}</Text>
          <Text style={[styles.th, styles.colQty]}>{t('documentPdf.qty')}</Text>
          <Text style={[styles.th, styles.colPrice]}>{t('documentPdf.unitPrice')}</Text>
          {showAdjustments ? <Text style={[styles.th, styles.colAdj]}>{t('documentPdf.discTax')}</Text> : null}
          <Text style={[styles.th, styles.colTotal]}>{t('documentPdf.amount')}</Text>
        </View>

        {data.items.map((item, index) => (
          <View key={index} style={styles.row} wrap={false}>
            <Text style={[styles.colDesc, own(item.description || '—')]}>{item.description || '—'}</Text>
            <Text style={styles.colQty}>{item.quantity}</Text>
            <Text style={styles.colPrice}>{money(item.unitPrice)}</Text>
            {showAdjustments ? (
              <Text style={[styles.colAdj, { color: INK.muted }]}>
                {item.discount > 0 ? `-${item.discount}%` : '—'}
                {item.taxRate > 0 ? ` / ${item.taxRate}%` : ''}
              </Text>
            ) : null}
            <Text style={styles.colTotal}>{money(item.total)}</Text>
          </View>
        ))}

        <View style={styles.totals}>
          <View style={styles.totalsRow}>
            <Text style={styles.totalsLabel}>{t('documentPdf.subtotal')}</Text>
            <Text style={styles.totalsValue}>{money(data.subtotal)}</Text>
          </View>
          {data.discountAmount > 0 ? (
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>{t('documentPdf.discount')}</Text>
              <Text style={styles.totalsValue}>-{money(data.discountAmount)}</Text>
            </View>
          ) : null}
          {data.taxAmount > 0 ? (
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>{t('documentPdf.tax')}</Text>
              <Text style={styles.totalsValue}>{money(data.taxAmount)}</Text>
            </View>
          ) : null}
          <View style={styles.grandRow}>
            <Text style={styles.grandLabel}>{t('documentPdf.total')}</Text>
            <Text style={styles.grandValue}>{money(data.total)}</Text>
          </View>

          {/* Amount due always prints on an invoice. It used to be hidden entirely
              until a payment existed, so an unpaid invoice — the case where it
              matters most — showed no balance at all. */}
          {isInvoice ? (
            <>
              {amountPaid > 0 ? (
                <View style={styles.totalsRow}>
                  <Text style={styles.totalsLabel}>{t('documentPdf.amountPaid')}</Text>
                  <Text style={styles.totalsValue}>-{money(amountPaid)}</Text>
                </View>
              ) : null}
              <View style={styles.dueRow}>
                <Text style={styles.grandLabel}>{t(amountDue > 0 ? 'documentPdf.amountDue' : 'documentPdf.paidInFull')}</Text>
                <Text style={styles.grandValue}>{money(amountDue)}</Text>
              </View>
            </>
          ) : null}
        </View>

        {isInvoice && payments.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('documentPdf.paymentHistory')}</Text>
            {payments.map((payment, index) => {
              const line = `${day(payment.paymentDate)} · ${method(payment.paymentMethod)}${payment.referenceNumber ? ` · ${payment.referenceNumber}` : ''}`;
              return (
                <View key={index} style={styles.row} wrap={false}>
                  <Text style={styles.colDesc}>{line}</Text>
                  <Text style={[styles.colTotal, { width: '54%' }]}>{money(payment.amount)}</Text>
                </View>
              );
            })}
          </View>
        ) : null}

        {data.notes ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('documentPdf.notes')}</Text>
            <Text style={[styles.body, own(data.notes)]}>{data.notes}</Text>
          </View>
        ) : null}

        {data.terms ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('documentPdf.terms')}</Text>
            <Text style={[styles.body, own(data.terms)]}>{data.terms}</Text>
          </View>
        ) : null}

        <Text
          style={styles.footer}
          render={({ pageNumber, totalPages }) =>
            `${data.workspaceName} · ${data.number} · ${t('documentPdf.page', { page: pageNumber, total: totalPages })}`
          }
          fixed
        />
      </Page>
    </Document>
  );
}

/** Render a quote or invoice to a PDF buffer, ready to serve or attach to an email. */
export async function renderDocumentPdf(data: PdfDocumentData, language?: PdfLanguage): Promise<Buffer> {
  if (language?.rtl) registerArabicFont();
  return renderToBuffer(<DocumentPdf data={data} language={language} />);
}

/** `INV-2026-0001.pdf` — the filename a client sees when they save the attachment. */
export function pdfFilename(data: Pick<PdfDocumentData, 'number'>): string {
  return `${data.number.replace(/[^A-Za-z0-9._-]/g, '_')}.pdf`;
}
