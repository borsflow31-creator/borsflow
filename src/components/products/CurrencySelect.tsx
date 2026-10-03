'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, Coins, Loader2 } from 'lucide-react';
import { useI18n } from '@/i18n/I18nProvider';
import { SUPPORTED_CURRENCIES, currencyLabel, currencySymbol } from '@/lib/currencies';
import { invalidateCached } from '@/lib/client-cache';

/**
 * The workspace currency, shown on the Products page. Owners and admins can
 * change it; everyone else just sees it. Changing it re-formats every price
 * (amounts are not converted) and becomes the default for new quotes/invoices.
 */
export default function CurrencySelect({
  workspaceId,
  currency,
  canChange,
  onChanged,
  onError,
}: {
  workspaceId: string;
  currency: string;
  canChange: boolean;
  onChanged: (currency: string) => void;
  onError?: (message: string) => void;
}) {
  const { t, locale } = useI18n();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);

  const choose = async (code: string) => {
    if (code === currency) { setOpen(false); return; }
    setSaving(code);
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currency: code }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || t('products.currency.saveFailed'));
      invalidateCached(`/api/workspaces/${workspaceId}`);
      onChanged(code);
      setOpen(false);
    } catch (err) {
      onError?.(err instanceof Error ? err.message : t('products.currency.saveFailed'));
    } finally {
      setSaving(null);
    }
  };

  const symbol = currencySymbol(currency, locale);

  if (!canChange) {
    return (
      <span
        title={t('products.currency.title')}
        className="inline-flex items-center gap-1.5 rounded-lg border border-outline-variant/20 bg-surface px-3 py-2.5 text-sm text-on-surface-variant"
      >
        <Coins className="h-4 w-4" strokeWidth={1.75} />
        {currency}
        {symbol !== currency ? <span className="opacity-70">({symbol})</span> : null}
      </span>
    );
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        title={t('products.currency.title')}
        className="flex items-center gap-2 rounded-lg border border-outline-variant/20 bg-surface px-3 py-2.5 text-sm font-medium text-on-surface transition-colors hover:bg-surface-container-low"
      >
        <Coins className="h-4 w-4" strokeWidth={1.75} />
        {currency}
        {symbol !== currency ? <span className="font-normal text-on-surface-variant">({symbol})</span> : null}
        <ChevronDown className={`h-3.5 w-3.5 text-on-surface-variant transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open ? (
        <div className="absolute right-0 top-full z-30 mt-2 w-72 rounded-xl border border-outline-variant/15 bg-surface p-1.5 shadow-xl">
          <p className="px-2.5 pb-2 pt-1.5 text-xs text-on-surface-variant">{t('products.currency.hint')}</p>
          <ul role="listbox" aria-label={t('products.currency.title')} className="max-h-72 overflow-y-auto">
            {SUPPORTED_CURRENCIES.map((code) => (
              <li key={code} role="option" aria-selected={code === currency}>
                <button
                  type="button"
                  onClick={() => void choose(code)}
                  disabled={saving !== null}
                  className={`flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition-colors disabled:opacity-60 ${
                    code === currency ? 'bg-secondary/10 text-secondary' : 'text-on-surface hover:bg-surface-container-low'
                  }`}
                >
                  <span className="truncate">{currencyLabel(code, locale)}</span>
                  {saving === code ? (
                    <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
                  ) : code === currency ? (
                    <Check className="h-4 w-4 shrink-0" />
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
