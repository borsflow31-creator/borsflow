/**
 * What every printed document shares: a black-and-white palette, and the Arabic
 * font for right-to-left documents.
 *
 * Documents carry no colour. They are printed, photocopied and faxed, and a
 * figure set apart only by being blue or red is lost on the way; weight, size and
 * rules carry the hierarchy instead.
 */

import path from 'path';
import { Font } from '@react-pdf/renderer';

export const INK = {
  /** Body text and every figure that matters. */
  text: '#111111',
  /** Labels and secondary lines. */
  muted: '#555555',
  /** Small print: section labels, the footer. */
  faint: '#888888',
  /** Hairlines between rows. */
  rule: '#d4d4d4',
} as const;

/** Any Arabic letter: such text runs right to left; everything else keeps its own order. */
export const ARABIC = /[؀-ۿݐ-ݿﭐ-﷿ﹰ-﻿]/;

const FONT_DIR = path.join(process.cwd(), 'src', 'lib', 'documents', 'fonts');
let arabicRegistered = false;

/**
 * Tajawal (bundled, SIL Open Font License) covers both Arabic and Latin, so names,
 * emails and references still print on an Arabic document.
 */
export function registerArabicFont() {
  if (arabicRegistered) return;
  Font.register({
    family: 'Tajawal',
    fonts: [
      { src: path.join(FONT_DIR, 'Tajawal-Regular.ttf'), fontWeight: 'normal' },
      { src: path.join(FONT_DIR, 'Tajawal-Bold.ttf'), fontWeight: 'bold' },
    ],
  });
  // Arabic words must not be split at arbitrary points.
  Font.registerHyphenationCallback((word) => [word]);
  arabicRegistered = true;
}

/** The regular and bold faces, by direction: Tajawal right to left, the built-in Helvetica otherwise. */
export function pdfFaces(rtl: boolean) {
  return rtl
    ? { regular: { fontFamily: 'Tajawal', fontWeight: 'normal' as const }, bold: { fontFamily: 'Tajawal', fontWeight: 'bold' as const } }
    : { regular: { fontFamily: 'Helvetica' }, bold: { fontFamily: 'Helvetica-Bold' } };
}

/**
 * Amounts as the locale writes them. The built-in PDF fonts have no narrow or
 * non-breaking space, which French and other locales use to group thousands; a
 * plain space prints the same.
 */
export function pdfMoney(locale: string, currency: string, n: number): string {
  return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(n ?? 0).replace(/[  ]/g, ' ');
}

export function pdfDay(locale: string, d: Date | string | null | undefined): string {
  if (!d) return '—';
  const parsed = new Date(d);
  if (Number.isNaN(parsed.getTime())) return '—';
  return parsed.toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' });
}
