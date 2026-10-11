/**
 * Captures the landing page screenshots from the agency demo
 * (scripts/demo/seed-agency.ts): the buyer board, a listing with competing
 * offers, and the commissions view, in dark theme at 2x.
 *
 *   npx tsx scripts/demo/seed-agency.ts
 *   npm run dev on port 3100 (NEXTAUTH_URL=http://localhost:3100), in another terminal
 *   node scripts/demo/capture-landing.mjs [--base http://localhost:3100] [--out dir] [--only crm,property]
 *   npx tsx scripts/demo/seed-agency.ts --remove
 *
 * Writes raw PNGs to --out; scripts/demo/encode-shots.mjs crops and encodes them
 * into public/shots. Playwright is not a project dependency: set PLAYWRIGHT_PATH,
 * or it falls back to the copy npx caches on this machine.
 */
import { createRequire } from 'module'
import { mkdirSync, readFileSync } from 'fs'
import { join } from 'path'

const arg = (name, fallback) => {
  const i = process.argv.indexOf(name)
  return i > -1 ? process.argv[i + 1] : fallback
}
const BASE = arg('--base', 'http://localhost:3100')
const OUT = arg('--out', 'landing-shots')
const ONLY = arg('--only', null)
const PW = process.env.PLAYWRIGHT_PATH
  ?? join(process.env.LOCALAPPDATA ?? '', 'npm-cache', '_npx', 'e41f203b7505f1fb', 'node_modules', 'playwright')

function demoPassword() {
  if (process.env.DEMO_PASSWORD) return process.env.DEMO_PASSWORD
  try {
    const line = readFileSync(join(process.cwd(), '.env'), 'utf8').split('\n').find((l) => /^\s*DEMO_PASSWORD\s*=/.test(l))
    if (line) return line.split('=').slice(1).join('=').trim().replace(/^["']|["']$/g, '')
  } catch {}
  throw new Error('Set DEMO_PASSWORD in .env (the password of the demo accounts).')
}

const { chromium } = createRequire(import.meta.url)(PW)

mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL ?? 'chrome' })
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 2,
  colorScheme: 'dark',
  locale: 'en-IE',
})
await context.addInitScript(() => {
  try {
    localStorage.setItem('app_locale', 'en')
    localStorage.setItem('app-storage', JSON.stringify({ state: { theme: 'dark' }, version: 0 }))
  } catch {}
})
const page = await context.newPage()
// The dev server's overlay badge is not part of the product.
await context.addInitScript(() => {
  addEventListener('DOMContentLoaded', () => {
    const style = document.createElement('style')
    style.textContent = 'nextjs-portal, #__next-build-watcher, [data-nextjs-toast] { display: none !important; }'
    document.head.appendChild(style)
  })
})

await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
// The first request compiles the page in dev, which can take a while.
await page.waitForSelector('#email', { timeout: 300000 })
await page.fill('#email', 'demo.agence@example.com')
await page.fill('#password', demoPassword())
await Promise.all([page.waitForURL(/\/dashboard/, { timeout: 60000 }), page.click('button[type="submit"]')])

const api = (path) => page.evaluate(async (p) => (await fetch(p)).json(), path)
const { workspaces } = await api('/api/workspaces')
const W = workspaces[0].id
const pipelinesRes = await api(`/api/pipelines?workspaceId=${W}`)
const pipelines = Array.isArray(pipelinesRes) ? pipelinesRes : pipelinesRes.pipelines
const buyerBoard = pipelines.find((p) => p.subjectType === 'Interest')
const property = await page.evaluate(async (w) => {
  const res = await (await fetch(`/api/properties?workspaceId=${w}`)).json()
  const list = Array.isArray(res) ? res : res.properties
  return list.find((p) => p.title.startsWith('Victorian terrace'))
}, W)

// [name, path, button to click first (a view or tab), if any]
const SHOTS = [
  ['crm', `/crm?workspace=${W}&pipeline=${buyerBoard.id}`, 'Board'],
  ['property', `/properties/${property.id}?workspace=${W}&tab=offers`],
  ['commissions', `/commissions?workspace=${W}`],
  ['commissions-accrued', `/commissions?workspace=${W}`, 'Accrued'],
  ['commissions-paid', `/commissions?workspace=${W}`, 'Paid'],
  ['offers', `/offers?workspace=${W}`],
]

for (const [name, path, click] of SHOTS) {
  if (ONLY && !ONLY.split(',').includes(name)) continue
  await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle', timeout: 90000 }).catch((e) => console.log(`${name}: ${e.message.split('\n')[0]}`))
  await page.waitForTimeout(1500)
  // Setup prompts (billing, onboarding) are not part of the product being shown.
  for (const label of ['Dismiss', 'Close', 'Not now', 'Later']) {
    const button = page.getByRole('button', { name: label, exact: true })
    if (await button.count()) await button.first().click({ timeout: 2000 }).catch(() => {})
  }
  if (click) {
    await page.locator(':is(button, [role="tab"], a):visible').filter({ hasText: new RegExp(`^\\s*${click}\\s*$`) }).first().click({ timeout: 10000 })
      .catch(() => console.log(`${name}: no "${click}" button`))
    await page.waitForLoadState('networkidle').catch(() => {})
    await page.waitForTimeout(1500)
  }
  await page.mouse.move(0, 899)
  await page.waitForTimeout(500)
  await page.screenshot({ path: join(OUT, `${name}.png`), fullPage: true })
  console.log(`captured ${name}`)
}

await browser.close()
console.log(`\nScreenshots in ${OUT}`)
