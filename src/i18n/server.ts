/**
 * Translation on the server, for text that leaves the app in someone's own
 * language (notification emails). Same catalogs and `{name}` placeholders as the
 * client's `useI18n().t`, with the same fallback to English for a missing key.
 */
import en, { type Messages } from './messages/en';
import type { Locale, MessageKey } from './I18nProvider';

export const LOCALES: readonly Locale[] = ['en', 'fr', 'es', 'ar', 'de'];

/** A stored or submitted language code, or null when it is not one we have. */
export function parseLocale(value: unknown): Locale | null {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value) ? (value as Locale) : null;
}

const LOADERS: Record<Locale, () => Promise<Messages>> = {
  en: async () => en,
  fr: () => import('./messages/fr').then((m) => m.default),
  es: () => import('./messages/es').then((m) => m.default),
  ar: () => import('./messages/ar').then((m) => m.default),
  de: () => import('./messages/de').then((m) => m.default),
};

const cache: Partial<Record<Locale, Messages>> = { en };

function lookup(catalog: Messages, key: string): string | undefined {
  const value = key.split('.').reduce<unknown>(
    (node, part) => (node && typeof node === 'object' ? (node as Record<string, unknown>)[part] : undefined),
    catalog
  );
  return typeof value === 'string' ? value : undefined;
}

export type ServerTranslate = (key: MessageKey, values?: Record<string, string | number>) => string;

/** `t` for one language. Unknown keys come back as the key, like the client's. */
export async function serverTranslator(locale: Locale | null | undefined): Promise<ServerTranslate> {
  const lang = locale ?? 'en';
  const catalog = (cache[lang] ??= await LOADERS[lang]());
  return (key, values) => {
    const message = lookup(catalog, key) ?? lookup(en, key) ?? key;
    return values ? message.replace(/\{(\w+)\}/g, (_, name: string) => (values[name] !== undefined ? String(values[name]) : `{${name}}`)) : message;
  };
}
