'use client';

import { useI18n, type Locale } from '@/i18n/I18nProvider';
import { Languages } from 'lucide-react';

interface LanguageSwitcherProps {
  /** Compact pill style (default) or icon-only */
  variant?: 'pill' | 'icon';
  className?: string;
}

const locales: { code: Locale; label: string; flag: string }[] = [
  { code: 'en', label: 'EN', flag: '🇬🇧' },
  { code: 'fr', label: 'FR', flag: '🇫🇷' },
];

export default function LanguageSwitcher({ variant = 'pill', className = '' }: LanguageSwitcherProps) {
  const { locale, setLocale, t } = useI18n();

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
        <div className="hidden group-hover:flex flex-col absolute right-0 top-full mt-1 bg-surface-container border border-outline-variant/20 rounded-xl shadow-lg overflow-hidden z-50">
          {locales.map(({ code, label, flag }) => (
            <button
              key={code}
              onClick={() => setLocale(code)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm transition-colors whitespace-nowrap ${
                locale === code
                  ? 'bg-secondary/10 text-secondary font-semibold'
                  : 'text-on-surface hover:bg-surface-container-high'
              }`}
            >
              <span>{flag}</span>
              {label}
            </button>
          ))}
        </div>
      </div>
    );
  }

  // pill variant — inline toggle buttons
  return (
    <div
      className={`flex items-center gap-0.5 bg-surface-container-low rounded-lg p-0.5 ${className}`}
      role="group"
      aria-label={t('misc.languageSelector')}
    >
      {locales.map(({ code, label, flag }) => (
        <button
          key={code}
          onClick={() => setLocale(code)}
          aria-pressed={locale === code}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
            locale === code
              ? 'bg-secondary text-on-secondary shadow-sm'
              : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high'
          }`}
        >
          <span aria-hidden>{flag}</span>
          {label}
        </button>
      ))}
    </div>
  );
}
