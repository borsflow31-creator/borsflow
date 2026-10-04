'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useI18n, type Locale } from '@/i18n/I18nProvider';
import { marketingHref } from '@/lib/seo/locales';
import { Languages } from 'lucide-react';

interface LanguageSwitcherProps {
  /** Compact pill style (default) or icon-only */
  variant?: 'pill' | 'icon';
  className?: string;
}

const locales: { code: Locale; label: string; flag: string }[] = [
  { code: 'en', label: 'EN', flag: '🇬🇧' },
  { code: 'fr', label: 'FR', flag: '🇫🇷' },
  { code: 'es', label: 'ES', flag: '🇪🇸' },
  { code: 'de', label: 'DE', flag: '🇩🇪' },
  { code: 'ar', label: 'AR', flag: '🇸🇦' },
];

/**
 * One language choice, rendered as whichever element is telling the truth.
 *
 * On a marketing page the translation has its own address, so this is a real
 * link: it navigates, it survives a middle-click, and a crawler following it
 * corroborates the hreflang set in the head. Inside the app there is no locale
 * segment to link to — the language is browser state — so it stays a button.
 *
 * `setLocale` runs either way, so a choice made on /fr still follows the
 * visitor once they sign in.
 */
function LocaleOption({
  code,
  href,
  selected,
  className,
  onChoose,
  children,
}: {
  code: Locale;
  href: string | null;
  selected: boolean;
  className: string;
  onChoose: (code: Locale) => void;
  children: React.ReactNode;
}) {
  if (href) {
    return (
      <Link
        href={href}
        hrefLang={code}
        aria-current={selected ? 'true' : undefined}
        onClick={() => onChoose(code)}
        className={className}
      >
        {children}
      </Link>
    );
  }

  return (
    <button type="button" onClick={() => onChoose(code)} aria-pressed={selected} className={className}>
      {children}
    </button>
  );
}

export default function LanguageSwitcher({ variant = 'pill', className = '' }: LanguageSwitcherProps) {
  const { locale, setLocale, t } = useI18n();
  const pathname = usePathname();

  if (variant === 'icon') {
    return (
      <div className={`relative group ${className}`}>
        <button
          className="p-2 text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high rounded-lg transition-colors"
          aria-label={t('misc.switchLanguage')}
        >
          <Languages className="h-5 w-5" />
        </button>
        {/* Dropdown */}
        <nav
          aria-label={t('misc.languageSelector')}
          className="hidden group-hover:flex flex-col absolute right-0 top-full mt-1 bg-surface-container border border-outline-variant/20 rounded-xl shadow-lg overflow-hidden z-50"
        >
          {locales.map(({ code, label, flag }) => (
            <LocaleOption
              key={code}
              code={code}
              href={marketingHref(pathname, code)}
              selected={locale === code}
              onChoose={setLocale}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm transition-colors whitespace-nowrap ${
                locale === code
                  ? 'bg-secondary/10 text-secondary font-semibold'
                  : 'text-on-surface hover:bg-surface-container-high'
              }`}
            >
              <span>{flag}</span>
              {label}
            </LocaleOption>
          ))}
        </nav>
      </div>
    );
  }

  // pill variant — inline toggle
  return (
    <div
      className={`flex items-center gap-0.5 bg-surface-container-low rounded-lg p-0.5 ${className}`}
      role="group"
      aria-label={t('misc.languageSelector')}
    >
      {locales.map(({ code, label, flag }) => (
        <LocaleOption
          key={code}
          code={code}
          href={marketingHref(pathname, code)}
          selected={locale === code}
          onChoose={setLocale}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
            locale === code
              ? 'bg-secondary text-on-secondary shadow-sm'
              : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high'
          }`}
        >
          <span aria-hidden>{flag}</span>
          {label}
        </LocaleOption>
      ))}
    </div>
  );
}
