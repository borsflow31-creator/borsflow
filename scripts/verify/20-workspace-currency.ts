/**
 * Scenario 20 — one currency, set in one place.
 *
 * A workspace picks its currency in Settings, and everything that prints money
 * is supposed to use it. The way that promise breaks is not a bug report: it is
 * a new file, months from now, writing `workspace?.currency || 'USD'` because
 * the author needed a fallback and typed the first one that came to mind. That
 * is how this codebase ended up falling back to EUR in the developer module, USD
 * on the dashboard and in the real-estate module, and EUR again in the buyer
 * portal — the same amount labelled three ways in one product.
 *
 * So this walks the source and fails on a hardcoded currency code near the word
 * "currency". The fallback belongs in src/lib/currencies.ts, and nowhere else.
 *
 * No database, no network.
 */

import { readdirSync, readFileSync, statSync } from 'fs'
import { join, relative } from 'path'
import { SUPPORTED_CURRENCIES, DEFAULT_CURRENCY, isSupportedCurrency } from '../../src/lib/currencies'
import { assert, assertEq, runScenario, section } from './_harness'

const ROOT = join(__dirname, '..', '..', 'src')

/**
 * Files allowed to name a currency literally:
 *  - currencies.ts, which is where the list and the default live;
 *  - the message catalogues, where "USD" is a label;
 *  - the SEO graph, which prices BorsFlow's own subscription plans, not a
 *    workspace's property.
 */
const ALLOWED = [
  'lib/currencies.ts',
  'i18n/messages/',
  'lib/seo/graph.ts',
]

/**
 * A currency code used as a value: assigned, defaulted or passed in. Comparing
 * against one is something else — `currency === 'DZD' ? 19 : 20` is Algeria's
 * VAT rate, which is domain logic and not a fallback — so comparisons are not
 * matched.
 */
const CODES = SUPPORTED_CURRENCIES.join('|')
const QUOTED = `['"\`](?:${CODES})['"\`]`
const FALLBACK = new RegExp(`(?:\\|\\||\\?\\?|=|:)\\s*${QUOTED}`)
const COMPARISON = new RegExp(`[=!]==?\\s*${QUOTED}`)

function sourceFiles(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      out.push(...sourceFiles(full))
    } else if (/\.tsx?$/.test(entry)) {
      out.push(full)
    }
  }
  return out
}

export default function scenario() {
  return runScenario('20 workspace currency (no DB)', async () => {
    section('the shared default is one of the currencies on offer')
    assert(isSupportedCurrency(DEFAULT_CURRENCY), `${DEFAULT_CURRENCY} is a supported currency`)
    assert(SUPPORTED_CURRENCIES.length > 1, 'there is a choice to make')
    assertEq(new Set(SUPPORTED_CURRENCIES).size, SUPPORTED_CURRENCIES.length, 'no duplicates in the list')

    section('no file invents its own currency fallback')
    const offenders: string[] = []
    for (const file of sourceFiles(ROOT)) {
      const rel = relative(ROOT, file).replace(/\\/g, '/')
      if (ALLOWED.some(allowed => rel.startsWith(allowed))) continue

      for (const [index, line] of readFileSync(file, 'utf8').split('\n').entries()) {
        if (!FALLBACK.test(line) || COMPARISON.test(line)) continue
        // Only where it is being used as a currency, not e.g. a country or a
        // locale string that happens to share the letters.
        if (!/currency|priceCurrency|formatMoney/i.test(line)) continue
        offenders.push(`${rel}:${index + 1}  ${line.trim().slice(0, 100)}`)
      }
    }

    assert(
      offenders.length === 0,
      offenders.length
        ? `these should read the workspace's currency, or DEFAULT_CURRENCY:\n    ${offenders.join('\n    ')}`
        : 'every fallback comes from src/lib/currencies.ts'
    )
  })
}

if (require.main === module) {
  scenario()
}
