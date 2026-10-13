'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import en, { type Messages } from './messages/en';
import { DEFAULT_CURRENCY } from '@/lib/currencies';

// ─── Types ────────────────────────────────────────────────────────────────────

export type Locale = 'en' | 'fr' | 'es' | 'ar' | 'de';

const RTL_LOCALES: ReadonlySet<Locale> = new Set(['ar']);

type DeepKeys<T, Prefix extends string = ''> = {
  [K in keyof T]: T[K] extends Record<string, unknown>
    ? DeepKeys<T[K], `${Prefix}${K & string}.`>
    : `${Prefix}${K & string}`;
}[keyof T];

export type MessageKey = DeepKeys<Messages>;

interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: MessageKey, values?: Record<string, string | number>) => string;
  formatDate: (date: Date | string | number, options?: Intl.DateTimeFormatOptions) => string;
  formatDateTime: (date: Date | string | number) => string;
  formatCurrency: (amount: number, currency?: string) => string;
  formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string;
}

// ─── Message catalogs ─────────────────────────────────────────────────────────

// English ships with the app (it's the fallback); the other catalogs are large
// (~100 KB each) and are only downloaded when a user picks that language.
const LOADERS: Record<Locale, () => Promise<Messages>> = {
  en: async () => en,
  fr: () => import('./messages/fr').then(m => m.default),
  es: () => import('./messages/es').then(m => m.default),
  ar: () => import('./messages/ar').then(m => m.default),
  de: () => import('./messages/de').then(m => m.default),
};

const catalogs: Partial<Record<Locale, Messages>> = { en };

/**
 * Catalogs handed to the provider by a locale-prefixed route, kept apart from
 * `catalogs`.
 *
 * A locale URL ships only the subtrees its page renders (landing, common,
 * misc) so the server does not serialise ~100 KB of app strings into the HTML
 * of a marketing page. If those partials were memoised as the real catalog,
 * `loadCatalog` would consider the locale already downloaded and a visitor who
 * walked from /fr into the app would get English for everything outside those
 * three subtrees. Resolution reads `catalogs` first, so the full download
 * supersedes a partial the moment it lands.
 */
const partials: Partial<Record<Locale, Messages>> = {};

async function loadCatalog(locale: Locale): Promise<Messages> {
  if (!catalogs[locale]) catalogs[locale] = await LOADERS[locale]();
  return catalogs[locale]!;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const I18nContext = createContext<I18nContextValue | null>(null);

// ─── Helper: get nested value by dot path ─────────────────────────────────────

function getNestedValue(obj: Record<string, unknown>, path: string): string {
  return path.split('.').reduce<unknown>((acc, key) => {
    if (acc && typeof acc === 'object') {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj) as string ?? path; // return key itself as fallback
}

// ─── Provider ─────────────────────────────────────────────────────────────────

const LOCALE_STORAGE_KEY = 'app_locale';
const DEFAULT_LOCALE: Locale = 'en';

export function I18nProvider({
  children,
  initialLocale,
  initialCatalog,
}: {
  children: React.ReactNode;
  /**
   * Pins the language, set by the locale-prefixed marketing routes. A URL is a
   * shareable, crawlable statement about which language a page is in, so it
   * outranks whatever this browser last stored.
   */
  initialLocale?: Locale;
  /** Partial catalog for `initialLocale`, merged over English. */
  initialCatalog?: Partial<Messages>;
}) {
  // Seeded during render rather than in an effect: the first paint — including
  // the server's — has to already be in the pinned language, or a crawler and
  // a reader both get English on a page that claims to be French.
  if (initialLocale && initialCatalog && !partials[initialLocale]) {
    partials[initialLocale] = { ...en, ...initialCatalog } as Messages;
  }

  const [locale, setLocaleState] = useState<Locale>(initialLocale ?? DEFAULT_LOCALE);

  // Load persisted locale on mount (after its catalog has downloaded). Skipped
  // when the URL pinned a language: the stored preference must not quietly
  // rewrite a page whose address says /fr.
  useEffect(() => {
    if (initialLocale) return;
    const saved = localStorage.getItem(LOCALE_STORAGE_KEY) as Locale | null;
    if (saved && saved !== DEFAULT_LOCALE && saved in LOADERS) {
      loadCatalog(saved).then(() => setLocaleState(saved)).catch(() => {});
    }
  }, [initialLocale]);

  // Update html lang/dir attributes when locale changes. The initial paint's
  // attributes are set synchronously by the inline script in layout.tsx (same
  // pattern as the dark-mode theme script) so there is no RTL flash — this
  // effect only handles changes made after mount via the language switcher.
  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = RTL_LOCALES.has(locale) ? 'rtl' : 'ltr';
  }, [locale]);

  const setLocale = useCallback((newLocale: Locale) => {
    localStorage.setItem(LOCALE_STORAGE_KEY, newLocale);
    // Keep showing the current language until the new catalog arrives
    loadCatalog(newLocale).then(() => setLocaleState(newLocale)).catch(() => {});
  }, []);

  /**
   * Translate a message key. Supports {variable} interpolation.
   */
  const t = useCallback(
    (key: MessageKey, values?: Record<string, string | number>): string => {
      const catalog = (catalogs[locale] ??
        partials[locale] ??
        en) as unknown as Record<string, unknown>;
      let message = getNestedValue(catalog, key);
      // A key missing from this language falls back to English
      if (message === key && catalog !== (en as unknown)) {
        message = getNestedValue(en as unknown as Record<string, unknown>, key);
      }

      // Interpolate {variable} placeholders
      if (values && typeof message === 'string') {
        message = message.replace(/\{(\w+)\}/g, (_, k) =>
          values[k] !== undefined ? String(values[k]) : `{${k}}`
        );
      }

      return message;
    },
    [locale]
  );

  /**
   * Format a date using the current locale, short form by default.
   */
  const formatDate = useCallback(
    (date: Date | string | number, options?: Intl.DateTimeFormatOptions): string => {
      const defaultOpts: Intl.DateTimeFormatOptions = {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        ...options,
      };
      return new Intl.DateTimeFormat(locale, defaultOpts).format(new Date(date));
    },
    [locale]
  );

  /**
   * Format a date with time component.
   */
  const formatDateTime = useCallback(
    (date: Date | string | number): string => {
      return new Intl.DateTimeFormat(locale, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date(date));
    },
    [locale]
  );

  /**
   * Format a currency amount using the given ISO currency code.
   *
   * Callers that print a workspace's money should pass its currency (see
   * useWorkspaceCurrency); the default is only for amounts that have none.
   */
  const formatCurrency = useCallback(
    (amount: number, currency: string = DEFAULT_CURRENCY): string => {
      return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(amount);
    },
    [locale]
  );

  /**
   * Format a generic number with optional Intl options.
   */
  const formatNumber = useCallback(
    (value: number, options?: Intl.NumberFormatOptions): string => {
      return new Intl.NumberFormat(locale, options).format(value);
    },
    [locale]
  );

  return (
    <I18nContext.Provider
      value={{ locale, setLocale, t, formatDate, formatDateTime, formatCurrency, formatNumber }}
    >
      {children}
    </I18nContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error('useI18n must be used inside <I18nProvider>');
  }
  return ctx;
}
