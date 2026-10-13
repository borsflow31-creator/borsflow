/**
 * End-to-end check of the new-lead form's API (units of interest, duplicates,
 * first follow-up, retry safety) against `next dev` on :3100, as the demo
 * owner. Every lead it creates is deleted at the end (by id), nothing else is touched.
 *   npx tsx scripts/demo/check-lead-intake.ts [--base http://localhost:3100]
 */
import { loadEnv, DEMO_USERS, demoPassword } from './env'

loadEnv()
const baseArg = process.argv.indexOf('--base')
const BASE = baseArg > -1 ? process.argv[baseArg + 1] : 'http://localhost:3100'
const results: { name: string; ok: boolean; detail: string }[] = []
const check = (name: string, ok: boolean, detail = '') => results.push({ name, ok, detail })

const cookies = new Map<string, string>()
const cookieHeader = () => [...cookies].map(([k, v]) => `${k}=${v}`).join('; ')
function keepCookies(res: Response) {
  for (const line of ((res.headers as any).getSetCookie?.() ?? []) as string[]) {
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
    method: 'POST', redirect: 'manual',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: cookieHeader() },
    body: new URLSearchParams({ csrfToken, email, password: demoPassword(), json: 'true' }),
  })
  keepCookies(res)
}
async function call(method: string, path: string, body?: unknown) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { Cookie: cookieHeader(), ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  let json: any = text
  try { json = JSON.parse(text) } catch { /* not json */ }
  return { status: res.status, body: json }
}

async function main() {
  const { prisma } = await import('../../src/lib/prisma')
  const owner = await prisma.user.findUniqueOrThrow({ where: { email: DEMO_USERS[0].email } })
  const ws = await prisma.workspace.findFirstOrThrow({ where: { ownerId: owner.id } })
  const W = ws.id
  const pipeline = await prisma.pipeline.findFirstOrThrow({ where: { workspaceId: W, subjectType: 'Lead' } as any })
  const created: string[] = []

  await login(DEMO_USERS[0].email)

  try {
    // Programmes and units
    const programs = (await call('GET', `/api/developer/programs?workspaceId=${W}`)).body.programs as any[]
    check('programs load', programs.length > 0, `${programs.length}`)
    const withStock = programs.find((p) => p.availableUnits > 1) ?? programs[0]
    const other = programs.find((p) => p.id !== withStock.id)

    const sel = await call('GET', `/api/developer/lots/selectable?workspaceId=${W}&programId=${withStock.id}`)
    const lots = sel.body.lots as any[]
    check('selectable lots load', sel.status === 200 && lots.length > 0, `${lots.length} in ${withStock.name}`)
    check('only available units', lots.every((l) => l.status === 'available'))
    check('only the chosen programme', lots.every((l) => l.program.id === withStock.id))
    check('no buyer data in picker', lots.every((l) => !('buyerLead' in l) && !('optionHolderLead' in l)))
    const q = lots[0].lotNumber
    const searched = (await call('GET', `/api/developer/lots/selectable?workspaceId=${W}&programId=${withStock.id}&q=${encodeURIComponent(q)}`)).body.lots as any[]
    check('server search by unit number', searched.some((l) => l.lotNumber === q), `q=${q} -> ${searched.length}`)
    const empty = (await call('GET', `/api/developer/lots/selectable?workspaceId=${W}&programId=${withStock.id}&q=zzzz-none`)).body.lots as any[]
    check('search with no match is empty', empty.length === 0)

    // Duplicates by phone in another format
    const existing = await prisma.lead.findFirstOrThrow({ where: { pipeline: { workspaceId: W }, phone: { not: null } }, select: { id: true, phone: true, email: true } })
    const digits = existing.phone!.replace(/[^\d+]/g, '')
    const reformatted = digits.startsWith('+') ? `00${digits.slice(1).replace(/(\d{3})(?=\d)/g, '$1 ')}` : digits.replace(/(\d{2})(?=\d)/g, '$1.')
    const dupPhone = await call('GET', `/api/leads/duplicates?workspaceId=${W}&phone=${encodeURIComponent(reformatted)}`)
    check('duplicate found by phone in another format', dupPhone.body.matches?.some((m: any) => m.id === existing.id), `${existing.phone} as ${reformatted}`)
    if (existing.email) {
      const dupEmail = await call('GET', `/api/leads/duplicates?workspaceId=${W}&email=${encodeURIComponent(existing.email.toUpperCase())}`)
      check('duplicate found by email, any case', dupEmail.body.matches?.some((m: any) => m.id === existing.id))
    }
    const noDup = await call('GET', `/api/leads/duplicates?workspaceId=${W}&phone=%2B99999999999`)
    check('unknown phone is no duplicate', noDup.body.matches?.length === 0)

    // Create with units + first task + request key
    const key = `e2e-${Date.now()}`
    const due = new Date(Date.now() + 24 * 3600 * 1000).toISOString()
    const payload = {
      firstName: 'E2E', lastName: 'Intake', phone: '+213 555 00 00 01', pipelineId: pipeline.id, workspaceId: W,
      interestedProgramId: withStock.id, interestedLotIds: [lots[0].id, lots[1]?.id].filter(Boolean),
      budgetMax: lots[0].totalPrice, clientRequestId: key,
      firstTask: { type: 'call', title: 'Rappeler', dueAt: due },
    }
    const c1 = await call('POST', '/api/leads', payload)
    check('create with units and follow-up', c1.status === 201, `${c1.status} ${JSON.stringify(c1.body).slice(0, 160)}`)
    const leadId = c1.body.id
    if (leadId) created.push(leadId)

    const c2 = await call('POST', '/api/leads', payload)
    check('retry with same key returns the same lead', c2.status === 200 && c2.body.id === leadId, `${c2.status} ${c2.body.id}`)
    const [count, tasks, interests] = await Promise.all([
      prisma.lead.count({ where: { clientRequestId: key } }),
      prisma.leadTask.findMany({ where: { leadId } }),
      prisma.leadLotInterest.findMany({ where: { leadId } }),
    ])
    check('one lead for the key', count === 1)
    check('one follow-up, not two', tasks.length === 1, `${tasks.length}`)
    check('follow-up assigned to the lead owner or creator', !!tasks[0]?.assigneeId)
    check('units of interest saved', interests.length === payload.interestedLotIds.length)
    const saved = await prisma.lead.findUniqueOrThrow({ where: { id: leadId } })
    check('nextFollowUpAt set from the task', saved.nextFollowUpAt?.toISOString() === due)
    check('lead has an owner', !!saved.ownerId)
    check('createdById recorded', saved.createdById === owner.id)
    const history = await prisma.activity.findFirst({ where: { leadId, type: 'task_created' } })
    check('follow-up in the lead history', !!history)

    // Implied programme
    const c3 = await call('POST', '/api/leads', {
      firstName: 'E2E', lastName: 'Implied', pipelineId: pipeline.id, workspaceId: W, interestedLotIds: [lots[0].id],
    })
    if (c3.body.id) created.push(c3.body.id)
    check('units with no project set the project', c3.status === 201 && c3.body.interestedProgramId === withStock.id)

    // Rejections
    if (other) {
      const otherLots = (await call('GET', `/api/developer/lots/selectable?workspaceId=${W}&programId=${other.id}`)).body.lots as any[]
      if (otherLots.length) {
        const bad = await call('POST', '/api/leads', {
          firstName: 'E2E', lastName: 'Bad', pipelineId: pipeline.id, workspaceId: W,
          interestedProgramId: withStock.id, interestedLotIds: [otherLots[0].id],
        })
        if (bad.body.id) created.push(bad.body.id)
        check('unit of another project refused', bad.status === 400, `${bad.status} ${bad.body.error}`)
      }
    }
    const reserved = await prisma.developmentLot.findFirst({ where: { workspaceId: W, status: { not: 'available' } } })
    if (reserved) {
      const bad = await call('POST', '/api/leads', {
        firstName: 'E2E', lastName: 'Reserved', pipelineId: pipeline.id, workspaceId: W, interestedLotIds: [reserved.id],
      })
      if (bad.body.id) created.push(bad.body.id)
      check('unavailable unit refused', bad.status === 400, `${bad.status} ${bad.body.error}`)
    }
    const foreign = await prisma.developmentLot.findFirst({ where: { workspaceId: { not: W } } })
    if (foreign) {
      const bad = await call('POST', '/api/leads', {
        firstName: 'E2E', lastName: 'Foreign', pipelineId: pipeline.id, workspaceId: W, interestedLotIds: [foreign.id],
      })
      if (bad.body.id) created.push(bad.body.id)
      check('unit of another workspace refused', bad.status === 400, `${bad.status} ${bad.body.error}`)
    }
    const badTask = await call('POST', '/api/leads', {
      firstName: 'E2E', lastName: 'NoDue', pipelineId: pipeline.id, workspaceId: W, firstTask: { type: 'call', title: 'x' },
    })
    if (badTask.body.id) created.push(badTask.body.id)
    check('follow-up without a date refused, no lead made', badTask.status === 400 && !badTask.body.id, `${badTask.status}`)
    const badBudget = await call('POST', '/api/leads', {
      firstName: 'E2E', lastName: 'Budget', pipelineId: pipeline.id, workspaceId: W, budgetMin: 10, budgetMax: 5,
    })
    if (badBudget.body.id) created.push(badBudget.body.id)
    check('min budget above max refused', badBudget.status === 400)

    // Read back and edit
    const g = await call('GET', `/api/leads/${leadId}`)
    check('lead GET returns interestedLots', Array.isArray(g.body.interestedLots) && g.body.interestedLots.length === payload.interestedLotIds.length)
    const put = await call('PUT', `/api/leads/${leadId}`, { interestedLotIds: [lots[0].id] })
    const after = await prisma.leadLotInterest.findMany({ where: { leadId } })
    check('PUT replaces the unit set', put.status === 200 && after.length === 1 && after[0].lotId === lots[0].id, `${put.status}`)
    const putNone = await call('PUT', `/api/leads/${leadId}`, { interestedLotIds: [] })
    check('PUT with [] clears units', putNone.status === 200 && (await prisma.leadLotInterest.count({ where: { leadId } })) === 0)

    // Minimal lead (agency-style payload) still works
    const min = await call('POST', '/api/leads', { firstName: 'E2E', lastName: 'Minimal', pipelineId: pipeline.id })
    if (min.body.id) created.push(min.body.id)
    check('minimal lead still creates', min.status === 201)
  } finally {
    for (const id of created) await call('DELETE', `/api/leads/${id}`)
    const left = await prisma.lead.count({ where: { id: { in: created } } })
    check('test leads cleaned up', left === 0, `${created.length} created, ${left} left`)
    await prisma.$disconnect()
  }

  for (const r of results) console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.detail ? `  (${r.detail})` : ''}`)
  const failed = results.filter((r) => !r.ok).length
  console.log(`\n${results.length - failed}/${results.length} passed`)
  process.exit(failed ? 1 : 0)
}

main().catch((e) => { console.error(e); process.exit(1) })
