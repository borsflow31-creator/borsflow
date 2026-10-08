/**
 * Opens every developer page in headless Chrome as the demo owner and reports
 * console errors, uncaught exceptions, failed requests and empty pages, with a
 * screenshot of each.
 *
 *   npm run dev   (in another terminal)
 *   node scripts/demo/check-pages.mjs [--base http://localhost:3000] [--out dir] [--locale fr]
 *
 * Playwright is not a project dependency: set PLAYWRIGHT_PATH to a playwright
 * package, or it falls back to the copy npx caches on this machine.
 */
import { createRequire } from 'module'
import { mkdirSync, readFileSync } from 'fs'
import { join } from 'path'

const arg = (name, fallback) => {
  const i = process.argv.indexOf(name)
  return i > -1 ? process.argv[i + 1] : fallback
}
const BASE = arg('--base', 'http://localhost:3000')
const OUT = arg('--out', 'demo-screenshots')
const LOCALE = arg('--locale', 'en')
const ONLY = arg('--only', null)
const PW = process.env.PLAYWRIGHT_PATH
  ?? join(process.env.LOCALAPPDATA ?? '', 'npm-cache', '_npx', 'e41f203b7505f1fb', 'node_modules', 'playwright')

/** DEMO_PASSWORD from the environment or the project's .env (never committed). */
function demoPassword() {
  if (process.env.DEMO_PASSWORD) return process.env.DEMO_PASSWORD
  try {
    const line = readFileSync(join(process.cwd(), '.env'), 'utf8').split('\n').find((l) => /^\s*DEMO_PASSWORD\s*=/.test(l))
    if (line) return line.split('=').slice(1).join('=').trim().replace(/^["']|["']$/g, '')
  } catch {}
  throw new Error('Set DEMO_PASSWORD in .env (the password of the demo accounts).')
}

const { chromium } = createRequire(import.meta.url)(PW)

const EMAIL = 'demo.promoteur@example.com'
const PASSWORD = demoPassword()

mkdirSync(OUT, { recursive: true })

// The installed Chrome, so no Playwright browser download is needed.
const browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL ?? 'chrome' })
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: LOCALE })
await context.addInitScript((locale) => { try { localStorage.setItem('app_locale', locale) } catch {} }, LOCALE)
const page = await context.newPage()

let current = 'login'
const problems = {}
const note = (msg) => { (problems[current] ??= []).push(msg) }
// Jumping straight to the next URL aborts the previous page's in-flight router
// fetch; Next logs that and falls back. It is this script's doing, not the page's.
const IGNORED = [/Failed to fetch RSC payload/]
page.on('console', (m) => {
  if (m.type() !== 'error' || IGNORED.some((re) => re.test(m.text()))) return
  note(`console: ${m.text().slice(0, 300)}`)
})
page.on('pageerror', (e) => note(`exception: ${String(e.message).slice(0, 300)}`))
page.on('response', (r) => {
  const url = r.url()
  if (r.status() >= 400 && url.startsWith(BASE) && !url.includes('/_next/static') && !url.includes('favicon')) {
    note(`HTTP ${r.status()} ${r.request().method()} ${url.replace(BASE, '')}`)
  }
})

// Log in through the real form
await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
// The first request compiles the page in dev, which can take a while.
await page.waitForSelector('#email', { timeout: 180000 }).catch(async (e) => {
  await page.screenshot({ path: join(OUT, 'login-failed.png') })
  throw e
})
await page.fill('#email', EMAIL)
await page.fill('#password', PASSWORD)
await Promise.all([page.waitForURL(/\/dashboard/, { timeout: 60000 }), page.click('button[type="submit"]')])

const api = (path) => page.evaluate(async (p) => (await fetch(p)).json(), path)
const { workspaces } = await api('/api/workspaces')
const W = workspaces[0].id
const { programs } = await api(`/api/developer/programs?workspaceId=${W}`)
const oran = programs.find((p) => p.reference === 'ORN-BED') ?? programs[0]

const PAGES = [
  ['dashboard', `/dashboard`],
  ['crm', `/crm?workspace=${W}`],
  ['programs', `/developer/programs?workspace=${W}`],
  ['program-detail', `/developer/programs/${oran.id}?workspace=${W}`],
  ['inventory', `/developer/inventory?workspace=${W}`],
  ['tasks', `/developer/tasks?workspace=${W}`],
  ['site-visits', `/developer/site-visits?workspace=${W}`],
  ['team', `/developer/team?workspace=${W}`],
  ['collections', `/developer/collections?workspace=${W}`],
  ['modifications', `/developer/modifications?workspace=${W}`],
  ['templates', `/developer/templates?workspace=${W}`],
  ['reports', `/developer/reports?workspace=${W}`],
  ['alerts', `/developer/alerts?workspace=${W}`],
  ['commissions', `/commissions?workspace=${W}`],
]

for (const [name, path] of PAGES) {
  if (ONLY && !ONLY.split(',').includes(name)) continue
  current = name
  try {
    await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle', timeout: 90000 })
  } catch (e) {
    note(`navigation: ${e.message.split('\n')[0]}`)
  }
  await page.waitForTimeout(800)
  const text = (await page.locator('main').innerText().catch(() => '')).trim()
  if (text.length < 40) note(`main area nearly empty (${text.length} chars)`)
  for (const bad of ['NaN', 'undefined', 'Invalid Date', '[object Object]']) {
    if (text.includes(bad)) note(`page text contains "${bad}"`)
  }
  // Right-to-left: the sidebar belongs on the right.
  if (LOCALE === 'ar') {
    const box = await page.locator('aside').first().boundingBox()
    if (box && box.x < 200) note(`sidebar is on the left in Arabic (x=${Math.round(box.x)})`)
  }
  // Outside English, no English should be left: system task titles, the project page.
  if (LOCALE !== 'en') {
    for (const english of ['Follow up on the reservation', 'Follow up after the site visit', 'Stacking plan', 'Calls for funds', 'Project information', 'Back to projects']) {
      if (text.includes(english)) note(`English left on the page: "${english}"`)
    }
  }
  await page.screenshot({ path: join(OUT, `${LOCALE}-${name}.png`), fullPage: true })
}

await browser.close()

let failed = 0
for (const [name] of PAGES) {
  if (ONLY && !ONLY.split(',').includes(name)) continue
  const list = problems[name] ?? []
  if (list.length) failed++
  console.log(`${list.length ? 'FAIL' : 'PASS'}  ${name}`)
  for (const p of [...new Set(list)]) console.log(`        ${p}`)
}
if (problems.login?.length) console.log('login:', problems.login)
console.log(`\nScreenshots in ${OUT}`)
process.exit(failed ? 1 : 0)
