/**
 * An amount of money written out in words, the way a receipt states it ("arrêté
 * le présent reçu à la somme de…"), in French, English, Spanish, German or
 * Arabic, up to 999 999 999 999.
 *
 * The currency's name and its plural come from Intl (`currencyDisplay: 'name'`),
 * so "dinars algériens", "euros" or "دينار جزائري" need no hand-kept table, and
 * the number of minor digits comes from Intl as well (TND has three).
 *
 * Pure: no database and no catalog, so it is checked by a verify script.
 */

export type WordsLanguage = 'fr' | 'en' | 'es' | 'de' | 'ar'

const MAX = 999_999_999_999

// ─── French ──────────────────────────────────────────────────────────────────

const FR_UNITS = [
  'zéro', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix',
  'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize', 'dix-sept', 'dix-huit', 'dix-neuf',
]
const FR_TENS = ['', '', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante']

function frBelow100(n: number, beforeMille: boolean): string {
  if (n < 20) return FR_UNITS[n]
  const t = Math.floor(n / 10)
  const u = n % 10
  if (t <= 6) return u === 0 ? FR_TENS[t] : u === 1 ? `${FR_TENS[t]} et un` : `${FR_TENS[t]}-${FR_UNITS[u]}`
  if (t === 7) return u === 1 ? 'soixante et onze' : `soixante-${FR_UNITS[10 + u]}`
  // Quatre-vingts takes its s only when it ends the number, and not before "mille".
  if (t === 8) return u === 0 ? (beforeMille ? 'quatre-vingt' : 'quatre-vingts') : `quatre-vingt-${FR_UNITS[u]}`
  return `quatre-vingt-${FR_UNITS[10 + u]}`
}

function frBelow1000(n: number, beforeMille = false): string {
  const h = Math.floor(n / 100)
  const r = n % 100
  if (h === 0) return frBelow100(r, beforeMille)
  const hundred = h === 1 ? 'cent' : `${FR_UNITS[h]} cent`
  if (r > 0) return `${hundred} ${frBelow100(r, beforeMille)}`
  // Cents takes its s only when nothing follows it, and not before "mille".
  return h > 1 && !beforeMille ? `${hundred}s` : hundred
}

function frWords(n: number): string {
  if (n === 0) return FR_UNITS[0]
  const parts: string[] = []
  const billions = Math.floor(n / 1e9)
  const millions = Math.floor((n % 1e9) / 1e6)
  const thousands = Math.floor((n % 1e6) / 1e3)
  const rest = n % 1e3
  // Milliard and million are nouns: they take an s, and the number before them keeps its own.
  if (billions) parts.push(billions === 1 ? 'un milliard' : `${frBelow1000(billions)} milliards`)
  if (millions) parts.push(millions === 1 ? 'un million' : `${frBelow1000(millions)} millions`)
  // Mille never takes an s, and "un mille" is just "mille".
  if (thousands) parts.push(thousands === 1 ? 'mille' : `${frBelow1000(thousands, true)} mille`)
  if (rest) parts.push(frBelow1000(rest))
  return parts.join(' ')
}

// ─── English ─────────────────────────────────────────────────────────────────

const EN_UNITS = [
  'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
  'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen',
]
const EN_TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety']

function enBelow1000(n: number): string {
  const h = Math.floor(n / 100)
  const r = n % 100
  const parts: string[] = []
  if (h) parts.push(`${EN_UNITS[h]} hundred`)
  if (r) parts.push(r < 20 ? EN_UNITS[r] : r % 10 ? `${EN_TENS[Math.floor(r / 10)]}-${EN_UNITS[r % 10]}` : EN_TENS[r / 10])
  return parts.join(' ')
}

function enWords(n: number): string {
  if (n === 0) return EN_UNITS[0]
  const scales: [number, string][] = [[1e9, 'billion'], [1e6, 'million'], [1e3, 'thousand'], [1, '']]
  const parts: string[] = []
  for (const [size, name] of scales) {
    const k = Math.floor(n / size) % 1000
    if (k) parts.push(name ? `${enBelow1000(k)} ${name}` : enBelow1000(k))
  }
  return parts.join(' ')
}

// ─── Spanish ─────────────────────────────────────────────────────────────────

const ES_BELOW30 = [
  'cero', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve', 'diez',
  'once', 'doce', 'trece', 'catorce', 'quince', 'dieciséis', 'diecisiete', 'dieciocho', 'diecinueve',
  'veinte', 'veintiuno', 'veintidós', 'veintitrés', 'veinticuatro', 'veinticinco', 'veintiséis', 'veintisiete', 'veintiocho', 'veintinueve',
]
const ES_TENS = ['', '', '', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa']
const ES_HUNDREDS = ['', 'ciento', 'doscientos', 'trescientos', 'cuatrocientos', 'quinientos', 'seiscientos', 'setecientos', 'ochocientos', 'novecientos']

function esBelow1000(n: number): string {
  if (n === 100) return 'cien'
  const h = Math.floor(n / 100)
  const r = n % 100
  const parts: string[] = []
  if (h) parts.push(ES_HUNDREDS[h])
  if (r) parts.push(r < 30 ? ES_BELOW30[r] : r % 10 ? `${ES_TENS[Math.floor(r / 10)]} y ${ES_BELOW30[r % 10]}` : ES_TENS[r / 10])
  return parts.join(' ')
}

/** "Uno" shortens before a noun: un millón, veintiún mil, un euro. */
function esApocope(words: string): string {
  return words.replace(/veintiuno$/, 'veintiún').replace(/(^|\s)uno$/, '$1un')
}

function esWords(n: number): string {
  if (n === 0) return ES_BELOW30[0]
  const parts: string[] = []
  const millions = Math.floor(n / 1e6)
  const thousands = Math.floor((n % 1e6) / 1e3)
  const rest = n % 1e3
  if (millions) {
    // Above a million, Spanish counts thousands of millions ("mil millones").
    parts.push(millions === 1 ? 'un millón' : `${esApocope(esWordsBelowMillion(millions))} millones`)
  }
  if (thousands) parts.push(thousands === 1 ? 'mil' : `${esApocope(esBelow1000(thousands))} mil`)
  if (rest) parts.push(esBelow1000(rest))
  return parts.join(' ')
}

function esWordsBelowMillion(n: number): string {
  const thousands = Math.floor(n / 1e3)
  const rest = n % 1e3
  const parts: string[] = []
  if (thousands) parts.push(thousands === 1 ? 'mil' : `${esApocope(esBelow1000(thousands))} mil`)
  if (rest) parts.push(esBelow1000(rest))
  return parts.join(' ')
}

// ─── German ──────────────────────────────────────────────────────────────────

const DE_UNITS = [
  'null', 'eins', 'zwei', 'drei', 'vier', 'fünf', 'sechs', 'sieben', 'acht', 'neun', 'zehn',
  'elf', 'zwölf', 'dreizehn', 'vierzehn', 'fünfzehn', 'sechzehn', 'siebzehn', 'achtzehn', 'neunzehn',
]
const DE_TENS = ['', '', 'zwanzig', 'dreißig', 'vierzig', 'fünfzig', 'sechzig', 'siebzig', 'achtzig', 'neunzig']

function deBelow1000(n: number): string {
  const h = Math.floor(n / 100)
  const r = n % 100
  let out = h ? `${h === 1 ? 'ein' : DE_UNITS[h]}hundert` : ''
  if (r) {
    if (r < 20) out += DE_UNITS[r]
    else out += `${r % 10 ? `${r % 10 === 1 ? 'ein' : DE_UNITS[r % 10]}und` : ''}${DE_TENS[Math.floor(r / 10)]}`
  }
  return out
}

/** Inside a compound or before a noun, "eins" is "ein". */
function deStem(words: string): string {
  return words.replace(/eins$/, 'ein')
}

function deWords(n: number): string {
  if (n === 0) return DE_UNITS[0]
  const parts: string[] = []
  const billions = Math.floor(n / 1e9)
  const millions = Math.floor((n % 1e9) / 1e6)
  const thousands = Math.floor((n % 1e6) / 1e3)
  const rest = n % 1e3
  if (billions) parts.push(billions === 1 ? 'eine Milliarde' : `${deBelow1000(billions)} Milliarden`)
  if (millions) parts.push(millions === 1 ? 'eine Million' : `${deBelow1000(millions)} Millionen`)
  // Below a million, German writes one word.
  const small = `${thousands ? `${deStem(deBelow1000(thousands))}tausend` : ''}${rest ? deBelow1000(rest) : ''}`
  if (small) parts.push(small)
  return parts.join(' ')
}

// ─── Arabic ──────────────────────────────────────────────────────────────────

const AR_UNITS = ['صفر', 'واحد', 'اثنان', 'ثلاثة', 'أربعة', 'خمسة', 'ستة', 'سبعة', 'ثمانية', 'تسعة', 'عشرة']
const AR_TEENS = ['', 'أحد عشر', 'اثنا عشر', 'ثلاثة عشر', 'أربعة عشر', 'خمسة عشر', 'ستة عشر', 'سبعة عشر', 'ثمانية عشر', 'تسعة عشر']
const AR_TENS = ['', '', 'عشرون', 'ثلاثون', 'أربعون', 'خمسون', 'ستون', 'سبعون', 'ثمانون', 'تسعون']
const AR_HUNDREDS = ['', 'مائة', 'مائتان', 'ثلاثمائة', 'أربعمائة', 'خمسمائة', 'ستمائة', 'سبعمائة', 'ثمانمائة', 'تسعمائة']

function arBelow1000(n: number): string {
  const h = Math.floor(n / 100)
  const r = n % 100
  const parts: string[] = []
  if (h) parts.push(AR_HUNDREDS[h])
  if (r) {
    if (r <= 10) parts.push(AR_UNITS[r])
    else if (r < 20) parts.push(AR_TEENS[r - 10])
    else parts.push(r % 10 ? `${AR_UNITS[r % 10]} و${AR_TENS[Math.floor(r / 10)]}` : AR_TENS[r / 10])
  }
  return parts.join(' و')
}

/**
 * A scale word with Arabic number agreement, which follows the last two digits:
 * one and two are the singular and dual alone, 3–10 take the plural, anything
 * else the singular ("أربعمائة وتسعة آلاف", "عشرون ألف").
 */
function arScale(k: number, one: string, two: string, plural: string): string {
  if (k === 1) return one
  if (k === 2) return two
  const r = k % 100
  return `${arBelow1000(k)} ${r >= 3 && r <= 10 ? plural : one}`
}

function arWords(n: number): string {
  if (n === 0) return AR_UNITS[0]
  const parts: string[] = []
  const billions = Math.floor(n / 1e9)
  const millions = Math.floor((n % 1e9) / 1e6)
  const thousands = Math.floor((n % 1e6) / 1e3)
  const rest = n % 1e3
  if (billions) parts.push(arScale(billions, 'مليار', 'ملياران', 'مليارات'))
  if (millions) parts.push(arScale(millions, 'مليون', 'مليونان', 'ملايين'))
  if (thousands) parts.push(arScale(thousands, 'ألف', 'ألفان', 'آلاف'))
  if (rest) parts.push(arBelow1000(rest))
  return parts.join(' و')
}

// ─── Assembly ────────────────────────────────────────────────────────────────

/** A whole number in words. */
export function numberInWords(n: number, lang: WordsLanguage): string {
  if (!Number.isInteger(n) || n < 0 || n > MAX) throw new RangeError(`Cannot write ${n} in words`)
  switch (lang) {
    case 'fr': return frWords(n)
    case 'en': return enWords(n)
    case 'es': return esWords(n)
    case 'de': return deWords(n)
    case 'ar': return arWords(n)
  }
}

const AND: Record<WordsLanguage, string> = { fr: ' et ', en: ' and ', es: ' con ', de: ' und ', ar: ' و' }

/** The word for the hundredths (or, for a three-decimal currency, thousandths). */
const MINOR: Record<WordsLanguage, { cents: [string, string]; mills: [string, string] }> = {
  fr: { cents: ['centime', 'centimes'], mills: ['millime', 'millimes'] },
  en: { cents: ['cent', 'cents'], mills: ['millime', 'millimes'] },
  es: { cents: ['céntimo', 'céntimos'], mills: ['milésimo', 'milésimos'] },
  de: { cents: ['Cent', 'Cent'], mills: ['Millime', 'Millimes'] },
  ar: { cents: ['سنتيم', 'سنتيم'], mills: ['مليم', 'مليم'] },
}

function currencyName(lang: WordsLanguage, currency: string, count: number): string {
  try {
    const parts = new Intl.NumberFormat(lang, { style: 'currency', currency, currencyDisplay: 'name', maximumFractionDigits: 0 })
      .formatToParts(count)
    return parts.find((p) => p.type === 'currency')?.value.trim() || currency
  } catch {
    return currency
  }
}

function minorDigits(currency: string): number {
  try {
    return new Intl.NumberFormat('en', { style: 'currency', currency }).resolvedOptions().maximumFractionDigits ?? 2
  } catch {
    return 2
  }
}

/**
 * "un million quatre cent neuf mille neuf cent soixante et onze dinars algériens
 * et cinquante centimes". Negative amounts are written as their absolute value;
 * the receipt says what the money was for.
 */
export function amountInWords(amount: number, currency: string, lang: WordsLanguage): string {
  const digits = minorDigits(currency)
  const scale = 10 ** digits
  const total = Math.round(Number((Math.abs(amount) * scale).toPrecision(15)))
  const whole = Math.floor(total / scale)
  const minor = total % scale

  let words = numberInWords(whole, lang)
  if (lang === 'es') words = esApocope(words)
  if (lang === 'de') words = deStem(words)
  let name = currencyName(lang, currency, whole)
  // "deux millions de dinars", "un millón de euros": a round million takes "de".
  if (whole >= 1e6 && whole % 1e6 === 0) {
    if (lang === 'fr') name = /^[aeiouyéèêh]/i.test(name) ? `d’${name}` : `de ${name}`
    if (lang === 'es') name = `de ${name}`
  }
  // Arabic counts one and two with the noun itself: "دينار جزائري واحد", "ديناران".
  let out = lang === 'ar' && whole === 1 ? `${name} ${words}` : lang === 'ar' && whole === 2 ? name : `${words} ${name}`

  if (minor > 0) {
    const [one, many] = digits === 3 ? MINOR[lang].mills : MINOR[lang].cents
    let minorWords = numberInWords(minor, lang)
    if (lang === 'es') minorWords = esApocope(minorWords)
    if (lang === 'de') minorWords = deStem(minorWords)
    out += `${AND[lang]}${minorWords} ${minor === 1 ? one : many}`
  }
  return out
}

/** The language a receipt is written in, for this module. Anything else reads as French. */
export function wordsLanguage(locale: string): WordsLanguage {
  const lang = locale.slice(0, 2)
  return lang === 'en' || lang === 'es' || lang === 'de' || lang === 'ar' ? lang : 'fr'
}
