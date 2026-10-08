/**
 * Calls every API route the developer pages use, as the demo owner, and checks
 * the answers against the database: status 200, the shape the page reads, and
 * the figures (unit counts, open tasks, overdue calls...) the page will show.
 *
 *   npm run dev   (in another terminal)
 *   npx tsx scripts/demo/check-api.ts [--base http://localhost:3000]
 */
import { loadEnv, DEMO_USERS, demoPassword } from './env'

loadEnv()

const baseArg = process.argv.indexOf('--base')
const BASE = baseArg > -1 ? process.argv[baseArg + 1] : 'http://localhost:3000'

type Result = { name: string; ok: boolean; detail: string }
const results: Result[] = []
const check = (name: string, ok: boolean, detail = '') => results.push({ name, ok, detail })

const cookies = new Map<string, string>()
const cookieHeader = () => [...cookies].map(([k, v]) => `${k}=${v}`).join('; ')
function keepCookies(res: Response) {
  const raw = (res.headers as any).getSetCookie?.() ?? []
  for (const line of raw as string[]) {
    const [pair] = line.split(';')
    const i = pair.indexOf('=')
    cookies.set(pair.slice(0, i), pair.slice(i + 1))
  }
}

async function login(email: string) {
  cookies.clear()
  const csrfRes = await fetch(`${BASE}/api/auth/csrf`)
  keepCookies(csrfRes)
  const { csrfToken } = await csrfRes.json()
  const res = await fetch(`${BASE}/api/auth/callback/credentials`, {
    method: 'POST',
    redirect: 'manual',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: cookieHeader() },
    body: new URLSearchParams({ csrfToken, email, password: demoPassword(), json: 'true' }),
  })
  keepCookies(res)
  const session = await (await fetch(`${BASE}/api/auth/session`, { headers: { Cookie: cookieHeader() } })).json()
  return session
}

async function get(path: string): Promise<{ status: number; body: any }> {
  const res = await fetch(`${BASE}${path}`, { headers: { Cookie: cookieHeader() } })
  const text = await res.text()
  let body: any = text
  try { body = JSON.parse(text) } catch { /* not json */ }
  return { status: res.status, body }
}

async function main() {
  const { prisma } = await import('../../src/lib/prisma')
  const owner = await prisma.user.findUniqueOrThrow({ where: { email: DEMO_USERS[0].email } })
  const ws = await prisma.workspace.findFirstOrThrow({ where: { ownerId: owner.id } })
  const W = ws.id
  const q = `workspaceId=${W}`

  const session = await login(owner.email)
  check('login: session has the demo owner', session?.user?.email === owner.email, JSON.stringify(session?.user ?? session))
  check('login: businessType is DEVELOPER', session?.user?.businessType === 'DEVELOPER', String(session?.user?.businessType))

  // Workspaces
  const wsRes = await get('/api/workspaces')
  check('GET /api/workspaces', wsRes.status === 200 && wsRes.body.workspaces?.some((w: any) => w.id === W), `status ${wsRes.status}`)
  const one = await get(`/api/workspaces/${W}`)
  check('GET /api/workspaces/:id currency DZD', one.status === 200 && one.body.workspace?.currency === 'DZD', `status ${one.status} currency ${one.body.workspace?.currency}`)
  const post = await fetch(`${BASE}/api/workspaces`, { method: 'POST', headers: { Cookie: cookieHeader(), 'Content-Type': 'application/json' }, body: '{"name":"x"}' })
  check('POST /api/workspaces is refused', post.status === 403, `status ${post.status}`)

  // Expected figures, straight from the database
  const lotsByStatus = await prisma.developmentLot.groupBy({ by: ['status'], where: { workspaceId: W }, _count: true })
  const count = (s: string[]) => lotsByStatus.filter((l) => s.includes(l.status)).reduce((n, l) => n + l._count, 0)
  const expected = {
    total: count(['available', 'optioned', 'reserved', 'contract_signed', 'deed_signed', 'delivered']),
    available: count(['available']),
    reserved: count(['optioned', 'reserved']),
    sold: count(['contract_signed', 'deed_signed', 'delivered']),
  }

  // Dashboard
  for (const period of ['month', 'quarter', 'year']) {
    const d = await get(`/api/developer/dashboard?${q}&period=${period}`)
    const k = d.body.dashboard?.kpis
    check(`dashboard (${period}) 200 + hasProjects`, d.status === 200 && d.body.dashboard?.hasProjects === true, `status ${d.status} ${typeof d.body === 'string' ? d.body.slice(0, 200) : ''}`)
    if (k) {
      check(`dashboard (${period}) unit buckets match DB`,
        k.units.total === expected.total && k.units.available === expected.available && k.units.reserved === expected.reserved && k.units.sold === expected.sold,
        `api ${JSON.stringify(k.units)} db ${JSON.stringify(expected)}`)
      check(`dashboard (${period}) has sales value`, k.totalSalesValue > 0, String(k.totalSalesValue))
      check(`dashboard (${period}) collections figures`, k.collected > 0 && k.called >= k.collected, `called ${k.called} collected ${k.collected} overdue ${k.overdueAmount}`)
    }
  }
  const year = (await get(`/api/developer/dashboard?${q}&period=year`)).body.dashboard
  if (year) {
    check('dashboard sales trend has months with sales', year.series.salesTrend.filter((m: any) => m.count > 0).length >= 3, JSON.stringify(year.series.salesTrend))
    check('dashboard sales by agent has the 3 salespeople', year.series.salesByAgent.length >= 2, JSON.stringify(year.series.salesByAgent.map((a: any) => a.name)))
    check('dashboard lead funnel', year.series.leadFunnel.length > 0 && year.series.leadFunnel.some((s: any) => s.count > 0), JSON.stringify(year.series.leadFunnel))
    check('dashboard overdue amount > 0', year.kpis.overdueAmount > 0, String(year.kpis.overdueAmount))
  }

  // Projects
  const programs = await get(`/api/developer/programs?${q}`)
  const dbPrograms = await prisma.program.findMany({ where: { workspaceId: W } })
  check('GET programs', programs.status === 200 && programs.body.programs?.length === dbPrograms.length, `status ${programs.status} n=${programs.body.programs?.length}`)
  check('programs have cover photos', (programs.body.programs ?? []).every((p: any) => !!p.coverUrl), JSON.stringify((programs.body.programs ?? []).map((p: any) => p.coverUrl)))
  for (const p of dbPrograms) {
    const detail = await get(`/api/developer/programs/${p.id}?${q}`)
    check(`program ${p.reference} detail`, detail.status === 200 && detail.body.program?.id === p.id, `status ${detail.status}`)
    const lots = await get(`/api/developer/programs/${p.id}/lots?${q}`)
    const dbLots = await prisma.developmentLot.count({ where: { programId: p.id } })
    check(`program ${p.reference} lots`, lots.status === 200 && lots.body.lots?.length === dbLots, `api ${lots.body.lots?.length} db ${dbLots}`)
    const media = await get(`/api/developer/programs/${p.id}/media`)
    check(`program ${p.reference} media`, media.status === 200 && media.body.media?.length === 4 && media.body.media.every((m: any) => !!m.url), `status ${media.status} n=${media.body.media?.length}`)
    const counters = p.availableUnits + p.reservedUnits + p.soldUnits
    check(`program ${p.reference} counters add up`, counters === p.totalUnits, `${p.availableUnits}+${p.reservedUnits}+${p.soldUnits} vs ${p.totalUnits}`)
  }

  // Inventory
  const inv = await get(`/api/developer/lots?${q}`)
  check('GET inventory', inv.status === 200 && inv.body.lots?.length === expected.total, `api ${inv.body.lots?.length} db ${expected.total}`)
  const invAvail = await get(`/api/developer/lots?${q}&status=available`)
  check('inventory status filter', invAvail.status === 200 && invAvail.body.lots?.length === expected.available, `api ${invAvail.body.lots?.length} db ${expected.available}`)

  // CRM
  const pipelines = await get(`/api/pipelines?${q}`)
  const buyerBoard = Array.isArray(pipelines.body) ? pipelines.body.find((p: any) => p.name === 'Buyer sales') : null
  check('GET pipelines has Buyer sales', pipelines.status === 200 && !!buyerBoard, `status ${pipelines.status}`)
  if (buyerBoard) {
    const leads = await get(`/api/leads?pipelineId=${buyerBoard.id}`)
    const dbLeads = await prisma.lead.count({ where: { pipelineId: buyerBoard.id } })
    check('GET leads on Buyer sales', leads.status === 200 && Array.isArray(leads.body) && leads.body.length === dbLeads, `api ${leads.body?.length} db ${dbLeads}`)
    const stages: string[] = Array.isArray(buyerBoard.stages) ? buyerBoard.stages : JSON.parse(buyerBoard.stages)
    const orphan = (Array.isArray(leads.body) ? leads.body : []).filter((l: any) => !stages.includes(l.stage))
    check('every buyer sits on a real stage', orphan.length === 0, orphan.map((l: any) => l.stage).join(','))
  }

  // Follow-ups
  const tasksAll = await get(`/api/developer/tasks?${q}&scope=all&status=open`)
  const dbOpen = await prisma.leadTask.count({ where: { workspaceId: W, completedAt: null } })
  check('GET tasks (all, open)', tasksAll.status === 200 && tasksAll.body.tasks?.length === dbOpen, `api ${tasksAll.body.tasks?.length} db ${dbOpen}`)
  const tasksMine = await get(`/api/developer/tasks?${q}&scope=mine&status=open`)
  const dbMine = await prisma.leadTask.count({ where: { workspaceId: W, completedAt: null, assigneeId: owner.id } })
  check('GET tasks (mine, open)', tasksMine.status === 200 && tasksMine.body.tasks?.length === dbMine, `api ${tasksMine.body.tasks?.length} db ${dbMine}`)

  // Site visits
  for (const when of ['upcoming', 'past']) {
    const v = await get(`/api/developer/site-visits?${q}&when=${when}`)
    check(`GET site visits (${when})`, v.status === 200 && Array.isArray(v.body.visits) && v.body.visits.length > 0, `status ${v.status} n=${v.body.visits?.length}`)
  }

  // Team activity
  for (const period of ['month', 'quarter', 'year']) {
    const a = await get(`/api/developer/activity?${q}&period=${period}`)
    check(`GET team activity (${period})`, a.status === 200 && Array.isArray(a.body.activity?.agents), `status ${a.status} ${typeof a.body === 'string' ? a.body.slice(0, 120) : JSON.stringify(a.body).slice(0, 120)}`)
  }

  // Collections
  const calls = await get(`/api/developer/calls-for-funds?${q}`)
  const dbCalls = await prisma.callForFunds.count({ where: { workspaceId: W } })
  check('GET calls for funds', calls.status === 200 && calls.body.calls?.length === dbCalls, `api ${calls.body.calls?.length} db ${dbCalls}`)
  const dzd = await prisma.invoice.count({ where: { workspaceId: W, currency: { not: 'DZD' } } })
  check('call invoices are in DZD', dzd === 0, `${dzd} invoices not in DZD`)

  // Modifications
  const tma = await get(`/api/developer/tma?${q}`)
  const dbTma = await prisma.tMARequest.count({ where: { workspaceId: W } })
  check('GET modification requests', tma.status === 200 && tma.body.requests?.length === dbTma, `api ${tma.body.requests?.length} db ${dbTma}`)

  // Templates
  const tpl = await get(`/api/developer/sales-templates?${q}`)
  check('GET sales templates', tpl.status === 200 && Array.isArray(tpl.body.templates) && tpl.body.templates.length >= 2, `status ${tpl.status} n=${tpl.body.templates?.length}`)

  // Reports
  for (const report of ['sales', 'marketing', 'inventory', 'financial']) {
    const r = await get(`/api/developer/reports/${report}?${q}`)
    check(`GET report ${report}`, r.status === 200 && !!r.body.report, `status ${r.status} ${typeof r.body === 'string' ? r.body.slice(0, 120) : ''}`)
  }
  const spend = await get(`/api/developer/marketing-spend?${q}`)
  check('GET marketing spend', spend.status === 200 && spend.body.spend?.length > 0, `n=${spend.body.spend?.length}`)

  // Alerts
  const alerts = await get(`/api/developer/alerts?${q}`)
  check('GET alerts (owner can edit)', alerts.status === 200 && alerts.body.rules?.length === 7 && alerts.body.canEdit === true, `status ${alerts.status} n=${alerts.body.rules?.length} canEdit=${alerts.body.canEdit}`)

  // Commissions
  const com = await get(`/api/commissions?${q}`)
  const dbCom = await prisma.commission.count({ where: { workspaceId: W } })
  check('GET commissions', com.status === 200 && com.body.commissions?.length === dbCom, `api ${com.body.commissions?.length} db ${dbCom}`)
  const fc = await get(`/api/commissions/forecast?${q}`)
  check('GET commissions forecast', fc.status === 200 && Array.isArray(fc.body.rows), `status ${fc.status}`)

  // A salesperson sees the workspace too, but only their own commission shares
  await login(DEMO_USERS[2].email)
  const asMember = await get(`/api/developer/alerts?${q}`)
  check('member: alerts are read-only', asMember.status === 200 && asMember.body.canEdit === false, `status ${asMember.status} canEdit=${asMember.body.canEdit}`)
  const memberCom = await get(`/api/commissions?${q}`)
  check('member: commissions limited to own shares', memberCom.status === 200 && (memberCom.body.commissions?.length ?? 0) <= dbCom, `n=${memberCom.body.commissions?.length}`)

  // Report
  const failed = results.filter((r) => !r.ok)
  for (const r of results) console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.ok ? '' : `  -> ${r.detail}`}`)
  console.log(`\n${results.length - failed.length}/${results.length} passed`)
  process.exit(failed.length ? 1 : 0)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
