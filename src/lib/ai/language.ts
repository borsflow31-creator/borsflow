import type { Locale } from '@/i18n/I18nProvider'

/**
 * The model names languages in English, so the instruction does too. Keyed by
 * the app's locales, which is why adding a locale is a type error here.
 */
const LANGUAGE_NAMES: Record<Locale, string> = {
  en: 'English',
  fr: 'French',
  es: 'Spanish',
  de: 'German',
  ar: 'Arabic',
}

/**
 * Pin an AI instruction to the language the app is showing.
 *
 * Without it the model answers in whatever language the surrounding data
 * happens to be in — a lead's notes are in French, the field labels we send are
 * in English, and the summary came back in English for a French user.
 */
export function promptInLocale(prompt: string, locale: Locale): string {
  return `${prompt}\nWrite your answer in ${LANGUAGE_NAMES[locale]}.`
}
