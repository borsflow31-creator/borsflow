/**
 * Drives the main actions of the developer pages in headless Chrome, as the demo
 * owner, and checks each one reaches the server and shows its result. It changes
 * the demo data (a unit gets reserved, a call paid...); run the seed with
 * --reset to start again from a clean demo.
 *
 *   npm run dev   (in another terminal)
 *   node scripts/demo/check-actions.mjs [--base http://localhost:3000] [--out dir]
 */
import { createRequire } from 'module'
import { mkdirSync, readFileSync } from 'fs'
import { join } from 'path'

const arg = (name, fallback) => {
  const i = process.argv.indexOf(name)
  return i > -1 ? process.argv[i + 1] : fallback
}
const BASE = arg('--base', 'http://localhost:3000')
const ONLY = arg('--only', null)
const OUT = arg('--out', 'demo-screenshots')
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

mkdirSync(OUT, { recursive: true })
const browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL ?? 'chrome' })
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true })
await context.addInitScript(() => { try { localStorage.setItem('app_locale', 'en') } catch {} })
const page = await context.newPage()

const errors = []
page.on('pageerror', (e) => errors.push(String(e.message)))

await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
await page.waitForSelector('#email', { timeout: 180000 })
await page.fill('#email', 'demo.promoteur@example.com')
await page.fill('#password', demoPassword())
await Promise.all([page.waitForURL(/\/dashboard/, { timeout: 60000 }), page.click('button[type="submit"]')])

const api = (path, init) => page.evaluate(async ([p, i]) => {
  const r = await fetch(p, i)
  return { status: r.status, body: await r.json().catch(() => null) }
}, [path, init])
const W = (await api('/api/workspaces')).body.workspaces[0].id
const go = (path) => page.goto(`${BASE}${path}${path.includes('?') ? '&' : '?'}workspace=${W}`, { waitUntil: 'networkidle', timeout: 90000 })
const waitFor = (method, fragment) => page.waitForResponse((r) => r.request().method() === method && r.url().includes(fragment), { timeout: 30000 })

const results = []
async function step(name, fn) {
  if (ONLY && !name.includes(ONLY)) return
  const before = errors.length
  try {
    const detail = await fn()
    if (errors.length > before) throw new Error(`page exception: ${errors.slice(before).join(' | ')}`)
    results.push({ name, ok: true, detail })
  } catch (e) {
    results.push({ name, ok: false, detail: String(e.message).split('\n')[0] })
    await page.screenshot({ path: join(OUT, `action-failed-${name.replace(/\W+/g, '-')}.png`), fullPage: true }).catch(() => {})
  }
}
const expectOk = async (promise, what) => {
  const res = await promise
  if (res.status() >= 400) throw new Error(`${what}: HTTP ${res.status()} ${(await res.text()).slice(0, 200)}`)
  return res
}

// ── Follow-ups: tick the first one ──
await step('complete a follow-up', async () => {
  await go('/developer/tasks')
  const done = page.getByRole('button', { name: 'Mark done' })
  const before = await done.count()
  if (!before) throw new Error('no open follow-up to complete')
  await expectOk(Promise.all([waitFor('PATCH', '/api/developer/tasks/'), done.first().click()]).then(([r]) => r), 'complete task')
  await page.waitForResponse((r) => r.request().method() === 'GET' && r.url().includes('/api/developer/tasks?'), { timeout: 30000 })
  await page.waitForTimeout(300)
  const after = await page.getByRole('button', { name: 'Mark done' }).count()
  if (after !== before - 1) throw new Error(`open follow-ups ${before} -> ${after}`)
  return `${before} -> ${after} open`
})

// ── Collections: record a payment ──
await step('mark a call for funds paid', async () => {
  await go('/developer/collections')
  const pay = page.getByRole('button', { name: 'Mark paid' })
  if (!(await pay.count())) throw new Error('no unpaid call')
  await pay.first().click()
  await expectOk(Promise.all([waitFor('POST', '/paid'), page.getByRole('button', { name: 'Record payment' }).click()]).then(([r]) => r), 'record payment')
  await page.waitForTimeout(800)
  return 'payment recorded'
})

// ── Modifications: accept a quoted request ──
await step('accept a modification request', async () => {
  await go('/developer/modifications')
  await page.getByRole('tab', { name: /Quote sent/ }).click()
  await page.locator('tbody tr').first().click()
  page.once('dialog', (d) => d.accept())
  await expectOk(Promise.all([waitFor('POST', '/accept'), page.getByRole('button', { name: 'Mark addendum signed' }).click()]).then(([r]) => r), 'accept TMA')
  await page.waitForTimeout(800)
  return 'accepted'
})

// ── Site visit: book one in the past, then record how it went ──
await step('record a site visit outcome', async () => {
  const pipelines = (await api(`/api/pipelines?workspaceId=${W}`)).body
  const board = pipelines.find((p) => p.name === 'Buyer sales')
  const leads = (await api(`/api/leads?pipelineId=${board.id}`)).body
  const buyer = leads.find((l) => l.stage === 'Contacted' && l.interestedProgramId)
  const booked = await api('/api/developer/site-visits', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ workspaceId: W, leadId: buyer.id, programId: buyer.interestedProgramId, startTime: new Date(Date.now() - 3 * 3600_000).toISOString(), duration: 45 }),
  })
  if (booked.status >= 400) throw new Error(`booking: HTTP ${booked.status} ${JSON.stringify(booked.body)}`)
  await go('/developer/site-visits')
  await page.getByRole('tab', { name: 'Needs outcome' }).click()
  await page.getByRole('button', { name: 'Record outcome' }).first().click()
  await page.getByRole('radio', { name: 'They came' }).click()
  await expectOk(Promise.all([waitFor('POST', '/outcome'), page.getByRole('button', { name: 'Save outcome' }).click()]).then(([r]) => r), 'save outcome')
  return `${buyer.firstName} ${buyer.lastName}`
})

// ── Reserve a unit from the project's stacking plan ──
await step('reserve a unit', async () => {
  const { programs } = (await api(`/api/developer/programs?workspaceId=${W}`)).body
  const project = programs.find((p) => p.reference === 'ALG-SY')
  const pipelines = (await api(`/api/pipelines?workspaceId=${W}`)).body
  const board = pipelines.find((p) => p.name === 'Buyer sales')
  const buyer = (await api(`/api/leads?pipelineId=${board.id}`)).body.find((l) => l.stage === 'Negotiation')
  await page.goto(`${BASE}/developer/programs/${project.id}?workspace=${W}`, { waitUntil: 'networkidle', timeout: 90000 })
  await page.getByRole('button', { name: 'Stacking plan' }).click()
  await page.getByRole('button', { name: /· Available$/ }).first().click()
  await page.getByRole('button', { name: 'Reserve', exact: true }).click()
  await page.getByPlaceholder('Search buyers by name or email').fill(buyer.lastName)
  // The first match in the picker's own results list.
  const results = page.getByPlaceholder('Search buyers by name or email').locator('xpath=following-sibling::div[1]')
  await results.getByRole('button', { name: new RegExp(buyer.lastName) }).first().click({ timeout: 15000 })
  await expectOk(Promise.all([waitFor('POST', '/reserve'), page.locator('form button[type=submit]').last().click()]).then(([r]) => r), 'reserve')
  return `${buyer.firstName} ${buyer.lastName}`
})

// ── CRM: board and list, and the choice is remembered ──
await step('switch the CRM between list and board', async () => {
  await go('/crm')
  const read = () => page.evaluate(() => localStorage.getItem('crm-view-mode-v2'))
  if (!(await page.locator('table').count())) throw new Error('CRM did not open on the list')
  await page.getByRole('button', { name: /kanban/i }).first().click()
  await page.waitForTimeout(800)
  if ((await read()) !== 'kanban') throw new Error('board choice not stored')
  await page.reload({ waitUntil: 'networkidle' })
  if (await page.locator('table').count()) throw new Error('board choice not kept after reload')
  await page.getByRole('button', { name: /list view/i }).first().click()
  await page.locator('table').first().waitFor({ timeout: 20000 }).catch(() => { throw new Error('list did not come back') })
  return 'list -> board -> reload -> list'
})

// ── Reports: CSV export ──
await step('export a report as CSV', async () => {
  await go('/developer/reports')
  const [download] = await Promise.all([page.waitForEvent('download', { timeout: 20000 }), page.getByRole('button', { name: 'Export CSV' }).click()])
  const name = download.suggestedFilename()
  if (!name.endsWith('.csv')) throw new Error(`downloaded ${name}`)
  return name
})

// ── Alerts: switch a rule off and on again ──
await step('change an alert rule', async () => {
  await go('/developer/alerts')
  // The rule's card is its own form, with the switch and the Save button.
  const card = page.getByText('Unit reserved', { exact: true }).locator('xpath=ancestor::form[1]')
  const box = card.getByRole('checkbox').first()
  await box.click()
  await expectOk(Promise.all([waitFor('PUT', '/api/developer/alerts'), card.getByRole('button', { name: 'Save' }).click()]).then(([r]) => r), 'save off')
  await box.click()
  await expectOk(Promise.all([waitFor('PUT', '/api/developer/alerts'), card.getByRole('button', { name: 'Save' }).click()]).then(([r]) => r), 'save on')
  return 'off then on'
})

// ── Sidebar and page guide ──
await step('sidebar descriptions and sections', async () => {
  await go('/developer/inventory')
  await page.getByRole('link', { name: 'Collections' }).hover()
  const tip = page.getByRole('tooltip')
  await tip.waitFor({ timeout: 5000 })
  const text = await tip.innerText()
  if (!/unpaid/i.test(text)) throw new Error(`tooltip says: ${text}`)
  const tools = page.getByRole('button', { name: /Tools/ })
  if ((await tools.getAttribute('aria-expanded')) !== 'false') throw new Error('Tools should start folded')
  await tools.click()
  if (!(await page.getByRole('link', { name: 'Meetings' }).isVisible())) throw new Error('Tools did not open')
  await page.reload({ waitUntil: 'networkidle' })
  if (!(await page.getByRole('link', { name: 'Meetings' }).isVisible())) throw new Error('Tools did not stay open')
  return 'tooltip + fold remembered'
})

await step('hide a page guide and keep it hidden', async () => {
  await go('/developer/inventory')
  await page.getByRole('button', { name: 'Hide' }).click()
  await page.reload({ waitUntil: 'networkidle' })
  if (await page.getByText('How this page works').count()) throw new Error('guide came back after reload')
  await page.getByRole('button', { name: 'Show how this page works' }).click()
  if (!(await page.getByText('How this page works').count())) throw new Error('guide did not reopen')
  return 'hidden, kept, reopened'
})

await browser.close()
for (const r of results) console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}  ${r.ok ? `(${r.detail})` : `-> ${r.detail}`}`)
const failed = results.filter((r) => !r.ok).length
console.log(`\n${results.length - failed}/${results.length} passed`)
process.exit(failed ? 1 : 0)
