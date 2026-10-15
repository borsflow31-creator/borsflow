import { prisma } from '@/lib/prisma';
import { parseLocale, serverTranslator } from '@/i18n/server';
import type { PdfLanguage } from './pdf';

/**
 * The language a document prints in: the requesting user's own, French when they
 * have not chosen one. Arabic prints right to left, with the Latin digits used in
 * the Maghreb.
 */
export async function pdfLanguageFor(userId: string): Promise<PdfLanguage> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { locale: true } });
  const lang = parseLocale(user?.locale) ?? 'fr';
  const rtl = lang === 'ar';
  return { t: await serverTranslator(lang), locale: rtl ? 'ar-u-nu-latn' : lang, rtl };
}
