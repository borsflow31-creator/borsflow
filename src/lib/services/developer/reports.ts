import { prisma } from '@/lib/prisma'
import { CALL_INVOICE_MONEY_SELECT, sumCallAmounts } from './call-balance'
import { signedAmount } from '@/lib/documents/payment-rules'
import {
  DEVELOPER_QUALIFIED_FROM_INDEX,
  DEVELOPER_SALES_PIPELINE,
  DEVELOPER_STAGE_LOST,
  parseStages,
} from '@/lib/crm/lifecycle'
import { bucketForLotStatus } from '@/lib/crm/projects'
import { ServiceError } from '../errors'
import type { DeveloperContext } from './programs'
import { DEFAULT_CURRENCY } from '@/lib/currencies'

/**
 * Reports for a developer's management: sales, marketing, inventory, finance.
 *
 * Every report comes back as the same shape -- a few summary figures and some
 * tables of typed columns -- so one page renders all of them and one function
 * exports any of them to CSV with headers in the viewer's language. Column labels
 * are keys, not text, for that reason: the service does not know the locale.
 *
 * Same method as the dashboard: narrow selects, aggregated in memory. A workspace's
 * stock is hundreds to a few thousand units and its leads a few thousand, which is
 * cheaper than the grouped queries it would take to answer the same questions in
 * SQL, and keeps every definition (what a "sale" is, what "qualified" means) in one
 * readable place.
 */

export const REPORTS = ['sales', 'marketing', 'inventory', 'financial'] as const
export type ReportName = (typeof REPORTS)[number]
export function isReportName(v: unknown): v is ReportName {
  return typeof v === 'string' && (REPORTS as readonly string[]).includes(v)
}

export type ColumnKind = 'text' | 'int' | 'money' | 'percent' | 'decimal' | 'month' | 'source' | 'date'
export type Cell = string | number | null

export interface ReportColumn { key: string; kind: ColumnKind }
export interface ReportTable { id: string; columns: ReportColumn[]; rows: Cell[][] }
export interface ReportSummaryItem { key: string; kind: ColumnKind; value: number | null }

export interface Report {
  report: ReportName
  from: string
  to: string
  currency: string
  summary: ReportSummaryItem[]
  tables: ReportTable[]
}

export interface ReportOptions {
  from?: Date
  to?: Date
  /** Marketing only: split by campaign as well as by source. */
  groupBy?: 'source' | 'campaign'
  now?: Date
}

const DAY_MS = 24 * 60 * 60 * 1000
const SLOW_MOVING_DAYS = 90
const UNKNOWN = 'unknown'

const sum = (xs: number[]) => xs.reduce((t, x) => t + x, 0)
const round = (n: number, places = 2) => Math.round(n * 10 ** places) / 10 ** places
const ratio = (num: number, den: number): number | null => (den > 0 ? num / den : null)
const pct = (num: number, den: number): number | null => (den > 0 ? round((num / den) * 100, 1) : null)
const monthKey = (d: Date) => d.toISOString().slice(0, 7)

/** Default window: this year so far, which is what a sales review usually starts from. */
export function defaultRange(now: Date): { from: Date; to: Date } {
  return { from: new Date(Date.UTC(now.getUTCFullYear(), 0, 1)), to: new Date(now.getTime() + DAY_MS) }
}

function median(xs: number[]): number | null {
  if (xs.length === 0) return null
  const s = [...xs].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

/** The months from `from` to `to`, as YYYY-MM, so an empty month still shows as zero. */
function monthsBetween(from: Date, to: Date): string[] {
  const out: string[] = []
  const cursor = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), 1))
  while (cursor < to && out.length < 60) {
    out.push(monthKey(cursor))
    cursor.setUTCMonth(cursor.getUTCMonth() + 1)
  }
  return out
}

interface Grouped { count: number; value: number }

function group<T>(rows: T[], key: (r: T) => string, value: (r: T) => number): Map<string, Grouped> {
  const out = new Map<string, Grouped>()
  for (const row of rows) {
    const k = key(row)
    const g = out.get(k) ?? { count: 0, value: 0 }
    g.count += 1
    g.value += value(row)
    out.set(k, g)
  }
  return out
}

/** A group map as table rows: label, units, value, average, share of the total. */
function groupRows(map: Map<string, Grouped>, total: number, sortByKey = false): Cell[][] {
  const entries = [...map.entries()]
  entries.sort(sortByKey ? (a, b) => a[0].localeCompare(b[0]) : (a, b) => b[1].value - a[1].value)
  return entries.map(([label, g]) => [label, g.count, round(g.value), round(g.value / g.count), pct(g.value, total)])
}

const GROUP_COLUMNS: ReportColumn[] = [
  { key: 'name', kind: 'text' },
  { key: 'units', kind: 'int' },
  { key: 'value', kind: 'money' },
  { key: 'averagePrice', kind: 'money' },
  { key: 'share', kind: 'percent' },
]

export async function getReport(ctx: DeveloperContext, report: ReportName, options: ReportOptions = {}): Promise<Report> {
  const now = options.now ?? new Date()
  const range = defaultRange(now)
  const from = options.from ?? range.from
  const to = options.to ?? range.to
  if (from >= to) throw new ServiceError('The start date must be before the end date')
  if (to.getTime() - from.getTime() > 5 * 366 * DAY_MS) throw new ServiceError('Choose a range of five years or less')

  const workspace = await prisma.workspace.findUnique({ where: { id: ctx.workspaceId }, select: { currency: true } })
  const currency = workspace?.currency || DEFAULT_CURRENCY
  const base = { report, from: from.toISOString(), to: to.toISOString(), currency }

  switch (report) {
    case 'sales': return { ...base, ...(await salesReport(ctx, from, to)) }
    case 'marketing': return { ...base, ...(await marketingReport(ctx, from, to, options.groupBy ?? 'source')) }
    case 'inventory': return { ...base, ...(await inventoryReport(ctx, now)) }
    case 'financial': return { ...base, ...(await financialReport(ctx, from, to, now)) }
  }
}

type Body = Pick<Report, 'summary' | 'tables'>

// ─── Sales ───────────────────────────────────────────────────────────────────

/**
 * A sale is a unit under contract or beyond, dated by its contract, falling back to
 * its reservation and then its last update for units that predate those columns:
 * the same definition as the dashboard, so the two never disagree on a month.
 */
async function salesReport(ctx: DeveloperContext, from: Date, to: Date): Promise<Body> {
  const lots = await prisma.developmentLot.findMany({
    where: { workspaceId: ctx.workspaceId, status: { in: ['contract_signed', 'deed_signed', 'delivered'] } },
    select: {
      type: true, typology: true, totalPrice: true, discount: true, salesAgentId: true,
      contractSignedAt: true, reservedAt: true, updatedAt: true,
      program: { select: { name: true, city: true } },
    },
  })
  const sold = lots.filter((l) => {
    const at = l.contractSignedAt ?? l.reservedAt ?? l.updatedAt
    return at >= from && at < to
  })

  const agentIds = [...new Set(sold.map((l) => l.salesAgentId).filter((id): id is string => !!id))]
  const agents = agentIds.length
    ? await prisma.user.findMany({ where: { id: { in: agentIds } }, select: { id: true, name: true, email: true } })
    : []
  const agentName = new Map(agents.map((a) => [a.id, a.name || a.email]))

  const total = sum(sold.map((l) => l.totalPrice))
  const date = (l: (typeof sold)[number]) => l.contractSignedAt ?? l.reservedAt ?? l.updatedAt

  const table = (id: string, key: (l: (typeof sold)[number]) => string, sortByKey = false): ReportTable => ({
    id,
    columns: GROUP_COLUMNS,
    rows: groupRows(group(sold, key, (l) => l.totalPrice), total, sortByKey),
  })

  const months = new Map<string, Grouped>(monthsBetween(from, to).map((m) => [m, { count: 0, value: 0 }]))
  for (const l of sold) {
    const g = months.get(monthKey(date(l)))
    if (g) { g.count += 1; g.value += l.totalPrice }
  }

  return {
    summary: [
      { key: 'unitsSold', kind: 'int', value: sold.length },
      { key: 'salesValue', kind: 'money', value: round(total) },
      { key: 'averagePrice', kind: 'money', value: sold.length ? round(total / sold.length) : null },
      { key: 'discountsGiven', kind: 'money', value: round(sum(sold.map((l) => l.discount))) },
    ],
    tables: [
      table('byProject', (l) => l.program.name),
      {
        id: 'byMonth',
        columns: [{ key: 'month', kind: 'month' }, ...GROUP_COLUMNS.slice(1, 4)],
        rows: [...months.entries()].map(([m, g]) => [m, g.count, round(g.value), g.count ? round(g.value / g.count) : null]),
      },
      table('byType', (l) => (l.typology ? `${l.type} · ${l.typology}` : l.type)),
      table('byAgent', (l) => (l.salesAgentId ? agentName.get(l.salesAgentId) ?? '–' : '–')),
      table('byCity', (l) => l.program.city),
    ],
  }
}

// ─── Marketing ───────────────────────────────────────────────────────────────

/**
 * Where buyers come from, and what it cost.
 *
 * A cohort report: it takes the leads *created* in the window and follows each one
 * to wherever it has got to, so a source that brought leads in March is judged on
 * what those leads became, not on how many sales happened to close in March.
 *
 * Reservations are counted from both the units currently held and the cancelled
 * deals (LotCancellation). Cancelling clears the buyer from the unit, so counting
 * only live units would quietly forget every buyer who reserved and then fell
 * through -- flattering a source whose reservations tend to collapse.
 *
 * Revenue is the value of units under contract, not margin, so it is reported as
 * revenue per unit of spend rather than as a profit percentage it cannot support.
 */
async function marketingReport(ctx: DeveloperContext, from: Date, to: Date, groupBy: 'source' | 'campaign'): Promise<Body> {
  const [pipeline, leads] = await Promise.all([
    prisma.pipeline.findFirst({ where: { workspaceId: ctx.workspaceId, name: DEVELOPER_SALES_PIPELINE.name }, select: { stages: true } }),
    prisma.lead.findMany({
      where: { pipeline: { workspaceId: ctx.workspaceId, name: DEVELOPER_SALES_PIPELINE.name }, createdAt: { gte: from, lt: to } },
      select: { id: true, source: true, campaign: true, stage: true, createdAt: true },
    }),
  ])
  const stages = parseStages(pipeline?.stages)
  const leadIds = leads.map((l) => l.id)

  const [visited, lots, cancelled, firstTouch, spend] = await Promise.all([
    leadIds.length
      ? prisma.meeting.findMany({
          where: { leadId: { in: leadIds }, programId: { not: null }, status: 'completed' },
          select: { leadId: true },
          distinct: ['leadId'],
        })
      : [],
    leadIds.length
      ? prisma.developmentLot.findMany({
          where: { buyerLeadId: { in: leadIds }, status: { in: ['reserved', 'contract_signed', 'deed_signed', 'delivered'] } },
          select: { buyerLeadId: true, status: true, totalPrice: true },
        })
      : [],
    leadIds.length
      ? prisma.lotCancellation.findMany({ where: { leadId: { in: leadIds } }, select: { leadId: true }, distinct: ['leadId'] })
      : [],
    leadIds.length
      ? prisma.activity.groupBy({
          by: ['leadId'],
          where: {
            leadId: { in: leadIds },
            type: { in: ['call_logged', 'site_visit_booked', 'task_completed'] },
          },
          _min: { createdAt: true },
        })
      : [],
    prisma.marketingSpend.findMany({
      where: { workspaceId: ctx.workspaceId, month: { gte: new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), 1)), lt: to } },
      select: { source: true, campaign: true, amount: true },
    }),
  ])

  const visitedSet = new Set(visited.map((v) => v.leadId))
  const reservedSet = new Set<string>([
    ...lots.map((l) => l.buyerLeadId!).filter(Boolean),
    ...cancelled.map((c) => c.leadId!).filter(Boolean),
  ])
  const soldByLead = new Map<string, number>()
  for (const l of lots) {
    if (l.buyerLeadId && bucketForLotStatus(l.status) === 'sold') {
      soldByLead.set(l.buyerLeadId, (soldByLead.get(l.buyerLeadId) ?? 0) + l.totalPrice)
    }
  }
  const touchAt = new Map(firstTouch.map((f) => [f.leadId, f._min.createdAt]))

  const qualified = (stage: string) => stage !== DEVELOPER_STAGE_LOST && stages.indexOf(stage) >= DEVELOPER_QUALIFIED_FROM_INDEX

  const keyOf = (source: string | null, campaign: string | null) => {
    const s = source?.trim().toLowerCase() || UNKNOWN
    return groupBy === 'campaign' ? `${s}\u0000${campaign?.trim() || ''}` : s
  }

  interface Row { source: string; campaign: string; leads: number; qualified: number; visits: number; reservations: number; sales: number; revenue: number; spend: number }
  const rows = new Map<string, Row>()
  const row = (source: string | null, campaign: string | null): Row => {
    const k = keyOf(source, campaign)
    let r = rows.get(k)
    if (!r) {
      r = { source: source?.trim().toLowerCase() || UNKNOWN, campaign: groupBy === 'campaign' ? campaign?.trim() || '' : '', leads: 0, qualified: 0, visits: 0, reservations: 0, sales: 0, revenue: 0, spend: 0 }
      rows.set(k, r)
    }
    return r
  }

  for (const lead of leads) {
    const r = row(lead.source, lead.campaign)
    r.leads += 1
    if (qualified(lead.stage)) r.qualified += 1
    if (visitedSet.has(lead.id)) r.visits += 1
    if (reservedSet.has(lead.id)) r.reservations += 1
    const revenue = soldByLead.get(lead.id)
    if (revenue !== undefined) { r.sales += 1; r.revenue += revenue }
  }
  for (const s of spend) row(s.source, s.campaign).spend += s.amount

  const list = [...rows.values()].sort((a, b) => b.revenue - a.revenue || b.leads - a.leads)

  const responseHours = leads
    .map((l) => touchAt.get(l.id))
    .map((t, i) => (t ? (t.getTime() - leads[i].createdAt.getTime()) / 3_600_000 : null))
    .filter((h): h is number => h !== null && h >= 0)

  const totals = list.reduce(
    (t, r) => ({ leads: t.leads + r.leads, sales: t.sales + r.sales, revenue: t.revenue + r.revenue, spend: t.spend + r.spend }),
    { leads: 0, sales: 0, revenue: 0, spend: 0 }
  )

  return {
    summary: [
      { key: 'newLeads', kind: 'int', value: totals.leads },
      { key: 'salesFromLeads', kind: 'int', value: totals.sales },
      { key: 'revenue', kind: 'money', value: round(totals.revenue) },
      { key: 'spend', kind: 'money', value: round(totals.spend) },
      { key: 'costPerLead', kind: 'money', value: totals.spend > 0 ? ratio(totals.spend, totals.leads) : null },
      { key: 'costPerSale', kind: 'money', value: totals.spend > 0 ? ratio(totals.spend, totals.sales) : null },
      { key: 'medianResponseHours', kind: 'decimal', value: median(responseHours) === null ? null : round(median(responseHours)!, 1) },
      { key: 'respondedWithin24h', kind: 'percent', value: pct(responseHours.filter((h) => h <= 24).length, leads.length) },
    ],
    tables: [
      {
        id: groupBy === 'campaign' ? 'bySourceCampaign' : 'bySource',
        columns: [
          { key: 'source', kind: 'source' },
          ...(groupBy === 'campaign' ? [{ key: 'campaign', kind: 'text' as const }] : []),
          { key: 'leads', kind: 'int' }, { key: 'qualified', kind: 'int' }, { key: 'visits', kind: 'int' },
          { key: 'reservations', kind: 'int' }, { key: 'sales', kind: 'int' }, { key: 'revenue', kind: 'money' },
          { key: 'spend', kind: 'money' }, { key: 'costPerLead', kind: 'money' }, { key: 'costPerSale', kind: 'money' },
          { key: 'revenuePerSpend', kind: 'decimal' },
        ],
        rows: list.map((r) => [
          r.source,
          ...(groupBy === 'campaign' ? [r.campaign] : []),
          r.leads, r.qualified, r.visits, r.reservations, r.sales, round(r.revenue),
          r.spend > 0 ? round(r.spend) : null,
          r.spend > 0 && r.leads > 0 ? round(r.spend / r.leads) : null,
          r.spend > 0 && r.sales > 0 ? round(r.spend / r.sales) : null,
          r.spend > 0 ? round(r.revenue / r.spend, 1) : null,
        ]),
      },
    ],
  }
}

// ─── Inventory ───────────────────────────────────────────────────────────────

async function inventoryReport(ctx: DeveloperContext, now: Date): Promise<Body> {
  const lots = await prisma.developmentLot.findMany({
    where: { workspaceId: ctx.workspaceId },
    select: {
      lotNumber: true, type: true, typology: true, status: true, totalPrice: true, surfaceArea: true,
      createdAt: true, contractSignedAt: true, reservedAt: true, updatedAt: true,
      program: { select: { name: true } },
    },
  })

  const sold = lots.filter((l) => bucketForLotStatus(l.status) === 'sold')
  const available = lots.filter((l) => l.status === 'available')
  const saleDate = (l: (typeof lots)[number]) => l.contractSignedAt ?? l.reservedAt ?? l.updatedAt

  // Units sold a month over the last three: a short window, so it reacts to a
  // launch weekend or a dry spell, but long enough that one week does not swing it.
  const recent = sold.filter((l) => now.getTime() - saleDate(l).getTime() <= 90 * DAY_MS)
  const soldArea = sum(sold.map((l) => l.surfaceArea))

  const typeLabel = (l: (typeof lots)[number]) => (l.typology ? `${l.type} · ${l.typology}` : l.type)
  const soldTotal = sum(sold.map((l) => l.totalPrice))

  const slow = available
    .map((l) => ({ l, days: Math.floor((now.getTime() - l.createdAt.getTime()) / DAY_MS) }))
    .filter((x) => x.days >= SLOW_MOVING_DAYS)
    .sort((a, b) => b.days - a.days)
    .slice(0, 100)

  const statusCount = group(lots, (l) => l.status, (l) => l.totalPrice)

  return {
    summary: [
      { key: 'totalUnits', kind: 'int', value: lots.length },
      { key: 'availableUnits', kind: 'int', value: available.length },
      { key: 'soldUnits', kind: 'int', value: sold.length },
      { key: 'averageSellingPrice', kind: 'money', value: sold.length ? round(soldTotal / sold.length) : null },
      { key: 'pricePerSquareMetre', kind: 'money', value: soldArea > 0 ? round(soldTotal / soldArea) : null },
      { key: 'salesVelocity', kind: 'decimal', value: round(recent.length / 3, 1) },
    ],
    tables: [
      {
        id: 'byStatus',
        columns: [{ key: 'status', kind: 'text' }, { key: 'units', kind: 'int' }, { key: 'value', kind: 'money' }],
        rows: [...statusCount.entries()].map(([s, g]) => [s, g.count, round(g.value)]),
      },
      { id: 'bestSellingTypes', columns: GROUP_COLUMNS, rows: groupRows(group(sold, typeLabel, (l) => l.totalPrice), soldTotal).slice(0, 15) },
      {
        id: 'slowMoving',
        columns: [{ key: 'unit', kind: 'text' }, { key: 'project', kind: 'text' }, { key: 'type', kind: 'text' }, { key: 'price', kind: 'money' }, { key: 'daysOnMarket', kind: 'int' }],
        rows: slow.map(({ l, days }) => [l.lotNumber, l.program.name, typeLabel(l), round(l.totalPrice), days]),
      },
    ],
  }
}

// ─── Financial ───────────────────────────────────────────────────────────────

async function financialReport(ctx: DeveloperContext, from: Date, to: Date, now: Date): Promise<Body> {
  const [sold, calls, commissions, received, deposits] = await Promise.all([
    prisma.developmentLot.findMany({
      where: { workspaceId: ctx.workspaceId, status: { in: ['contract_signed', 'deed_signed', 'delivered'] } },
      select: { totalPrice: true, discount: true, contractSignedAt: true, reservedAt: true, updatedAt: true },
    }),
    prisma.callForFunds.findMany({
      where: { workspaceId: ctx.workspaceId, status: { not: 'draft' } },
      select: { amount: true, status: true, dueAt: true, issuedAt: true, paidAt: true, invoice: CALL_INVOICE_MONEY_SELECT },
    }),
    prisma.commission.findMany({
      where: { workspaceId: ctx.workspaceId, lotId: { not: null }, status: { not: 'cancelled' }, createdAt: { gte: from, lt: to } },
      select: { grossAmount: true, status: true },
    }),
    // Money collected is what was confirmed received in the window, on the date it
    // arrived: partial payments count, pending cheques and reversed rows do not,
    // refunds count against.
    prisma.payment.findMany({
      where: {
        status: 'confirmed',
        paymentDate: { gte: from, lt: to },
        invoice: { workspaceId: ctx.workspaceId, callForFunds: { isNot: null } },
      },
      select: { amount: true, kind: true, paymentDate: true },
    }),
    // Deposits are their own line: they are not called, so they stay out of
    // "collected", which must keep adding up with "called" and "outstanding".
    prisma.payment.findMany({
      where: {
        status: 'confirmed',
        paymentDate: { gte: from, lt: to },
        invoice: { workspaceId: ctx.workspaceId, depositForLotId: { not: null } },
      },
      select: { amount: true, kind: true },
    }),
  ])

  const inRange = (d: Date | null) => !!d && d >= from && d < to
  const soldInRange = sold.filter((l) => inRange(l.contractSignedAt ?? l.reservedAt ?? l.updatedAt))
  const owed = sumCallAmounts(calls, now.getTime())

  const calledInRange = calls.filter((c) => inRange(c.issuedAt))

  const months = new Map(monthsBetween(from, to).map((m) => [m, { called: 0, collected: 0 }]))
  for (const c of calledInRange) { const m = months.get(monthKey(c.issuedAt!)); if (m) m.called += c.amount }
  for (const p of received) { const m = months.get(monthKey(p.paymentDate)); if (m) m.collected += signedAmount(p) }

  const commissionSum = (status: string) => round(sum(commissions.filter((c) => c.status === status).map((c) => c.grossAmount)))

  return {
    summary: [
      { key: 'salesValue', kind: 'money', value: round(sum(soldInRange.map((l) => l.totalPrice))) },
      { key: 'called', kind: 'money', value: round(sum(calledInRange.map((c) => c.amount))) },
      { key: 'collected', kind: 'money', value: round(sum(received.map(signedAmount))) },
      // Right now, whatever the window: what is owed is a fact about today.
      { key: 'outstanding', kind: 'money', value: round(owed.outstanding) },
      { key: 'overdue', kind: 'money', value: round(owed.overdue) },
      { key: 'depositsReceived', kind: 'money', value: round(sum(deposits.map(signedAmount))) },
      { key: 'discountsGiven', kind: 'money', value: round(sum(soldInRange.map((l) => l.discount))) },
    ],
    tables: [
      {
        id: 'collectionsByMonth',
        columns: [{ key: 'month', kind: 'month' }, { key: 'called', kind: 'money' }, { key: 'collected', kind: 'money' }],
        rows: [...months.entries()].map(([m, v]) => [m, round(v.called), round(v.collected)]),
      },
      {
        id: 'commissions',
        columns: [{ key: 'status', kind: 'text' }, { key: 'amount', kind: 'money' }],
        rows: ['accrued', 'realized', 'paid'].map((s) => [s, commissionSum(s)]),
      },
    ],
  }
}
