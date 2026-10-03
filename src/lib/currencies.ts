// Currencies a workspace can price its catalog and documents in. Shared by the
// workspace setting, products, quotes and invoices so the lists never drift.

export const SUPPORTED_CURRENCIES = [
  'EUR', 'USD', 'GBP', 'CHF', 'CAD', 'AUD', 'DZD', 'MAD', 'TND', 'XOF', 'AED', 'SAR',
] as const

export type CurrencyCode = (typeof SUPPORTED_CURRENCIES)[number]

export const DEFAULT_CURRENCY: CurrencyCode = 'USD'

export function isSupportedCurrency(value: unknown): value is CurrencyCode {
  return typeof value === 'string' && (SUPPORTED_CURRENCIES as readonly string[]).includes(value)
}

/** "EUR · Euro" in the user's language (falls back to the code). */
export function currencyLabel(code: string, locale: string) {
  try {
    const name = new Intl.DisplayNames([locale], { type: 'currency' }).of(code)
    return name && name !== code ? `${code} · ${name}` : code
  } catch {
    return code
  }
}

/** Just the symbol, e.g. "€" or "MAD". */
export function currencySymbol(code: string, locale: string) {
  try {
    const part = new Intl.NumberFormat(locale, { style: 'currency', currency: code, currencyDisplay: 'narrowSymbol' })
      .formatToParts(0)
      .find(p => p.type === 'currency')
    return part?.value ?? code
  } catch {
    return code
  }
}
