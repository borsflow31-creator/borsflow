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
 * Arabic receipts are set in Tajawal (bundled, SIL Open Font License), which
 * covers both Arabic and Latin so names, emails and references still print, and
 * are laid out right to left. Every other language keeps the built-in Helvetica.
 */

import React from 'react';
import path from 'path';
import { Document, Font, Page, Text, View, StyleSheet, renderToBuffer } from '@react-pdf/renderer';
import type { ServerTranslate } from '@/i18n/server';
import { amountInWords, wordsLanguage } from './amount-in-words';

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

const FONT_DIR = path.join(process.cwd(), 'src', 'lib', 'documents', 'fonts');
let fontsRegistered = false;

function registerArabicFont() {
  if (fontsRegistered) return;
  Font.register({
    family: 'Tajawal',
    fonts: [
      { src: path.join(FONT_DIR, 'Tajawal-Regular.ttf'), fontWeight: 'normal' },
      { src: path.join(FONT_DIR, 'Tajawal-Bold.ttf'), fontWeight: 'bold' },
    ],
  });
  // Arabic words must not be split at arbitrary points.
  Font.registerHyphenationCallback((word) => [word]);
  fontsRegistered = true;
}

const COLORS = { ink: '#1a1a1a', muted: '#6b7280', faint: '#9ca3af', rule: '#e5e7eb', accent: '#1e40af', void: '#b91c1c' };

function makeStyles(rtl: boolean) {
  const regular = rtl ? { fontFamily: 'Tajawal', fontWeight: 'normal' as const } : { fontFamily: 'Helvetica' };
  const bold = rtl ? { fontFamily: 'Tajawal', fontWeight: 'bold' as const } : { fontFamily: 'Helvetica-Bold' };
  const row = rtl ? 'row-reverse' as const : 'row' as const;
  const start = rtl ? 'right' as const : 'left' as const;
  const end = rtl ? 'left' as const : 'right' as const;
  const text = rtl ? { direction: 'rtl' as const, textAlign: start } : { textAlign: start };
  return StyleSheet.create({
    page: { paddingTop: 44, paddingBottom: 56, paddingHorizontal: 44, fontSize: 10, color: COLORS.ink, ...regular },
    text,
    header: { flexDirection: row, justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 },
    title: { fontSize: 20, ...bold, ...text },
    number: { fontSize: 11, color: COLORS.muted, marginTop: 4, ...text },
    workspace: { fontSize: 11, ...bold, textAlign: end, ...(rtl ? { direction: 'rtl' as const } : {}) },
    // Letter spacing and capitals break Arabic joining, so they are Latin-only.
    label: { fontSize: 8, color: COLORS.faint, marginBottom: 4, ...(rtl ? {} : { textTransform: 'uppercase' as const, letterSpacing: 0.6 }), ...text },
    block: { marginBottom: 18 },
    strong: { fontSize: 11, ...bold, marginBottom: 2, ...text },
    line: { fontSize: 10, marginBottom: 2, ...text },
    amountBox: { borderWidth: 1, borderColor: COLORS.ink, padding: 14, marginTop: 18, marginBottom: 6 },
    amount: { fontSize: 22, ...bold, color: COLORS.accent, ...text },
    words: { fontSize: 9, color: COLORS.muted, marginBottom: 18, lineHeight: 1.4, ...text },
    row: { flexDirection: row, justifyContent: 'space-between', borderBottomWidth: 0.5, borderBottomColor: COLORS.rule, paddingVertical: 6 },
    rowLabel: { color: COLORS.muted, ...text },
    rowValue: { textAlign: end, maxWidth: '60%', ...(rtl ? { direction: 'rtl' as const } : {}) },
    void: { position: 'absolute', top: 300, left: 60, right: 60, textAlign: 'center', fontSize: 64, ...bold, color: COLORS.void, opacity: 0.25, transform: 'rotate(-20deg)' },
    signature: { marginTop: 40, flexDirection: row, justifyContent: 'flex-end' },
    signatureBox: { width: '45%', borderTopWidth: 0.5, borderTopColor: COLORS.muted, paddingTop: 6 },
    footer: { position: 'absolute', bottom: 26, left: 44, right: 44, textAlign: 'center', fontSize: 8, color: COLORS.faint, ...(rtl ? { direction: 'rtl' as const } : {}) },
  });
}

/** Any Arabic letter: such text runs right to left; everything else keeps its own order. */
const ARABIC = /[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]/;

function ReceiptPdf({ data, t }: { data: ReceiptPdfData; t: ServerTranslate }) {
  const rtl = Boolean(data.rtl);
  const styles = makeStyles(rtl);
  // On an Arabic receipt, a phone number, an email or a reference is laid out left
  // to right (still aligned right), or the bidi algorithm reverses its groups.
  const own = (text: string) => (rtl && !ARABIC.test(text) ? { direction: 'ltr' as const } : {});
  // The built-in PDF fonts have no narrow or non-breaking space, which French and
  // other locales use to group thousands; a plain space prints the same.
  const money = (n: number) =>
    new Intl.NumberFormat(data.locale, { style: 'currency', currency: data.currency }).format(n ?? 0).replace(/[  ]/g, ' ');
  const day = (d: Date | string | null | undefined) =>
    d ? new Date(d).toLocaleDateString(data.locale, { day: 'numeric', month: 'long', year: 'numeric' }) : '—';
  const reversed = data.status === 'reversed';
  const unit = [data.programName, data.programReference ? `(${data.programReference})` : null, `· ${data.lotNumber}`]
    .filter(Boolean)
    .join(' ');
  const words = amountInWords(data.amount, data.currency, wordsLanguage(data.locale));

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
          <View>
            <Text style={styles.title}>{t('developerSales.receipt.title')}</Text>
            <Text style={[styles.number, own(data.receiptNumber)]}>{data.receiptNumber}</Text>
          </View>
          <Text style={[styles.workspace, own(data.workspaceName)]}>{data.workspaceName}</Text>
        </View>

        <View style={styles.block}>
          <Text style={styles.label}>{t('developerSales.receipt.receivedFrom')}</Text>
          <Text style={[styles.strong, own(data.buyer.name)]}>{data.buyer.name}</Text>
          {data.buyer.email ? <Text style={[styles.line, own(data.buyer.email)]}>{data.buyer.email}</Text> : null}
          {data.buyer.phone ? <Text style={[styles.line, own(data.buyer.phone)]}>{data.buyer.phone}</Text> : null}
        </View>

        <View style={styles.block}>
          <Text style={styles.label}>{t('developerSales.receipt.unit')}</Text>
          <Text style={[styles.line, own(unit)]}>{unit}</Text>
          {data.contractNumber ? (
            <Text style={styles.line}>{t('developerSales.receipt.contract')} {data.contractNumber}</Text>
          ) : null}
        </View>

        <View style={styles.amountBox}>
          <Text style={styles.label}>{t('developerSales.receipt.amountReceived')}</Text>
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
          <View style={[styles.block, { marginTop: 18 }]}>
            <Text style={[styles.label, { color: COLORS.void }]}>{t('developerSales.receipt.cancelledReason')}</Text>
            <Text style={styles.line}>{data.reversalReason}</Text>
          </View>
        ) : null}

        <View style={styles.signature}>
          <View style={styles.signatureBox}>
            <Text style={styles.rowLabel}>{t('developerSales.receipt.issuer')}</Text>
            <Text style={styles.line}>{data.workspaceName}</Text>
          </View>
        </View>

        <Text style={styles.footer} fixed>
          {`${data.workspaceName} · ${data.receiptNumber} · ${t('developerSales.receipt.issuedOn')} ${day(data.confirmedAt ?? data.paymentDate)}`}
        </Text>
      </Page>
    </Document>
  );
}

export async function renderReceiptPdf(data: ReceiptPdfData, t: ServerTranslate): Promise<Buffer> {
  if (data.rtl) registerArabicFont();
  return renderToBuffer(<ReceiptPdf data={data} t={t} />);
}
