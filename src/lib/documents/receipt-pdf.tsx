/**
 * Payment receipt (reçu d'encaissement) PDF.
 *
 * Rendered from the stored payment row every time it is asked for, so a lost or
 * failed download is fixed by asking again: nothing is recorded twice and the
 * number never changes. A reversed payment still renders, marked cancelled, so a
 * copy already handed to the buyer can be matched to what happened to it.
 *
 * Labels arrive translated from the caller (the server translator, in the
 * requesting user's language), because react-pdf renders outside I18nProvider.
 *
 * Black and white only (see pdf-theme). Arabic receipts are set in Tajawal and
 * laid out right to left; every other language keeps the built-in Helvetica.
 */

import React from 'react';
import { Document, Page, Text, View, StyleSheet, renderToBuffer } from '@react-pdf/renderer';
import type { ServerTranslate } from '@/i18n/server';
import { amountInWords, wordsLanguage } from './amount-in-words';
import { ARABIC, INK, pdfDay, pdfFaces, pdfMoney, registerArabicFont } from './pdf-theme';

export interface ReceiptPdfData {
  receiptNumber: string;
  status: string;
  workspaceName: string;
  currency: string;
  /** Intl locale for numbers and dates, e.g. `fr` or `ar-u-nu-latn`. */
  locale: string;
  /** Right-to-left layout, in the bundled Arabic font. */
  rtl?: boolean;
  buyer: { name: string; email?: string | null; phone?: string | null };
  programName: string;
  programReference?: string | null;
  lotNumber: string;
  contractNumber?: string | null;
  /** The call number, or the deposit's invoice number. */
  callNumber: string;
  /** The milestone, or "Dépôt de garantie". */
  milestoneTitle: string;
  /** The payment is for the unit's reservation deposit rather than a call. */
  isDeposit?: boolean;
  paymentDate: Date | string;
  amount: number;
  method: string;
  reference?: string | null;
  recordedBy?: string | null;
  confirmedAt?: Date | string | null;
  remainingOnCall: number;
  remainingOnContract: number;
  reversalReason?: string | null;
}

function makeStyles(rtl: boolean) {
  const { regular, bold } = pdfFaces(rtl);
  const row = rtl ? 'row-reverse' as const : 'row' as const;
  const start = rtl ? 'right' as const : 'left' as const;
  const end = rtl ? 'left' as const : 'right' as const;
  const text = rtl ? { direction: 'rtl' as const, textAlign: start } : { textAlign: start };
  const endText = rtl ? { direction: 'rtl' as const, textAlign: end } : { textAlign: end };
  return StyleSheet.create({
    page: { paddingTop: 48, paddingBottom: 60, paddingHorizontal: 52, fontSize: 10, color: INK.text, ...regular },
    text,
    // The issuer on one side, what the document is on the other, over a heavy rule.
    header: { flexDirection: row, justifyContent: 'space-between', alignItems: 'flex-start', paddingBottom: 14, borderBottomWidth: 1.5, borderBottomColor: INK.text, marginBottom: 26 },
    issuer: { fontSize: 13, ...bold, ...text },
    docBlock: { alignItems: rtl ? 'flex-start' as const : 'flex-end' as const },
    // Letter spacing and capitals break Arabic joining, so they are Latin-only.
    title: { fontSize: 12, ...bold, ...(rtl ? {} : { textTransform: 'uppercase' as const, letterSpacing: 1.2 }), ...endText },
    number: { fontSize: 10, color: INK.muted, marginTop: 4, ...endText },
    columns: { flexDirection: row, justifyContent: 'space-between', marginBottom: 24 },
    column: { width: '48%' },
    label: { fontSize: 8, color: INK.faint, marginBottom: 5, ...(rtl ? {} : { textTransform: 'uppercase' as const, letterSpacing: 0.8 }), ...text },
    strong: { fontSize: 11, ...bold, marginBottom: 2, ...text },
    line: { fontSize: 10, marginBottom: 2, ...text },
    amountBox: { borderTopWidth: 1, borderBottomWidth: 1, borderColor: INK.text, paddingVertical: 14, marginBottom: 8, flexDirection: row, justifyContent: 'space-between', alignItems: 'center' },
    amountLabel: { fontSize: 10, color: INK.muted, ...text },
    amount: { fontSize: 22, ...bold, ...endText },
    words: { fontSize: 9, color: INK.muted, marginBottom: 22, lineHeight: 1.4, ...text },
    row: { flexDirection: row, justifyContent: 'space-between', borderBottomWidth: 0.5, borderBottomColor: INK.rule, paddingVertical: 7 },
    rowLabel: { color: INK.muted, ...text },
    rowValue: { textAlign: end, maxWidth: '60%', ...(rtl ? { direction: 'rtl' as const } : {}) },
    void: { position: 'absolute', top: 300, left: 60, right: 60, textAlign: 'center', fontSize: 64, ...bold, color: INK.faint, opacity: 0.35, transform: 'rotate(-20deg)' },
    signature: { marginTop: 48, flexDirection: row, justifyContent: 'flex-end' },
    signatureBox: { width: '45%', borderTopWidth: 0.5, borderTopColor: INK.muted, paddingTop: 6, minHeight: 60 },
    footer: { position: 'absolute', bottom: 28, left: 52, right: 52, textAlign: 'center', fontSize: 8, color: INK.faint, ...(rtl ? { direction: 'rtl' as const } : {}) },
  });
}

function ReceiptPdf({ data, t }: { data: ReceiptPdfData; t: ServerTranslate }) {
  const rtl = Boolean(data.rtl);
  const styles = makeStyles(rtl);
  // On an Arabic receipt, a phone number, an email or a reference is laid out left
  // to right (still aligned right), or the bidi algorithm reverses its groups.
  const own = (text: string) => (rtl && !ARABIC.test(text) ? { direction: 'ltr' as const } : {});
  const money = (n: number) => pdfMoney(data.locale, data.currency, n);
  const day = (d: Date | string | null | undefined) => pdfDay(data.locale, d);
  const reversed = data.status === 'reversed';
  const unit = [data.programName, data.programReference ? `(${data.programReference})` : null, `· ${data.lotNumber}`]
    .filter(Boolean)
    .join(' ');
  const words = amountInWords(data.amount, data.currency, wordsLanguage(data.locale));
  const issuedOn = day(data.confirmedAt ?? data.paymentDate);

  const rows: [string, string][] = [
    [t('developerSales.receipt.paymentDate'), day(data.paymentDate)],
    [t('developerSales.receipt.method'), t(`developerSales.collections.method_${data.method}` as Parameters<ServerTranslate>[0])],
    ...(data.reference ? [[t('developerSales.receipt.reference'), data.reference] as [string, string]] : []),
    data.isDeposit
      ? [data.milestoneTitle, data.callNumber]
      : [t('developerSales.receipt.call'), `${data.callNumber} · ${data.milestoneTitle}`],
    // Balances are as of the day the receipt is printed, and say so.
    [
      t(data.isDeposit ? 'developerSales.receipt.remainingOnDeposit' : 'developerSales.receipt.remainingOnCall', { date: day(new Date()) }),
      money(data.remainingOnCall),
    ],
    [t('developerSales.receipt.remainingOnContract', { date: day(new Date()) }), money(data.remainingOnContract)],
    ...(data.recordedBy ? [[t('developerSales.receipt.recordedBy'), data.recordedBy] as [string, string]] : []),
  ];

  return (
    <Document title={`${t('developerSales.receipt.title')} ${data.receiptNumber}`} author={data.workspaceName} language={rtl ? 'ar' : undefined}>
      <Page size="A4" style={styles.page}>
        {reversed ? <Text style={styles.void}>{t('developerSales.receipt.cancelled')}</Text> : null}

        <View style={styles.header}>
          <Text style={[styles.issuer, own(data.workspaceName)]}>{data.workspaceName}</Text>
          <View style={styles.docBlock}>
            <Text style={styles.title}>{t('developerSales.receipt.title')}</Text>
            <Text style={[styles.number, own(data.receiptNumber)]}>{data.receiptNumber}</Text>
            <Text style={styles.number}>{t('developerSales.receipt.issuedOn')} {issuedOn}</Text>
          </View>
        </View>

        <View style={styles.columns}>
          <View style={styles.column}>
            <Text style={styles.label}>{t('developerSales.receipt.receivedFrom')}</Text>
            <Text style={[styles.strong, own(data.buyer.name)]}>{data.buyer.name}</Text>
            {data.buyer.phone ? <Text style={[styles.line, own(data.buyer.phone)]}>{data.buyer.phone}</Text> : null}
            {data.buyer.email ? <Text style={[styles.line, own(data.buyer.email)]}>{data.buyer.email}</Text> : null}
          </View>
          <View style={styles.column}>
            <Text style={styles.label}>{t('developerSales.receipt.unit')}</Text>
            <Text style={[styles.strong, own(unit)]}>{unit}</Text>
            {data.contractNumber ? (
              <Text style={styles.line}>{t('developerSales.receipt.contract')} {data.contractNumber}</Text>
            ) : null}
          </View>
        </View>

        <View style={styles.amountBox}>
          <Text style={styles.amountLabel}>{t('developerSales.receipt.amountReceived')}</Text>
          <Text style={styles.amount}>{money(data.amount)}</Text>
        </View>
        <Text style={styles.words}>{t('developerSales.receipt.amountInWords', { words })}</Text>

        {rows.map(([label, value]) => (
          <View key={label} style={styles.row} wrap={false}>
            <Text style={styles.rowLabel}>{label}</Text>
            <Text style={[styles.rowValue, own(value)]}>{value}</Text>
          </View>
        ))}

        {reversed && data.reversalReason ? (
          <View style={{ marginTop: 18 }}>
            <Text style={styles.label}>{t('developerSales.receipt.cancelledReason')}</Text>
            <Text style={styles.line}>{data.reversalReason}</Text>
          </View>
        ) : null}

        <View style={styles.signature}>
          <View style={styles.signatureBox}>
            <Text style={styles.rowLabel}>{t('developerSales.receipt.issuer')}</Text>
            <Text style={[styles.line, own(data.workspaceName)]}>{data.workspaceName}</Text>
          </View>
        </View>

        <Text style={styles.footer} fixed>
          {`${data.workspaceName} · ${data.receiptNumber} · ${t('developerSales.receipt.issuedOn')} ${issuedOn}`}
        </Text>
      </Page>
    </Document>
  );
}

export async function renderReceiptPdf(data: ReceiptPdfData, t: ServerTranslate): Promise<Buffer> {
  if (data.rtl) registerArabicFont();
  return renderToBuffer(<ReceiptPdf data={data} t={t} />);
}
