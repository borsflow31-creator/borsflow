import { prisma } from '@/lib/prisma'
import {
  DEVELOPER_OPEN_STAGES,
  DEVELOPER_QUALIFIED_FROM_INDEX,
  DEVELOPER_SALES_PIPELINE,
  parseStages,
} from '@/lib/crm/lifecycle'
import { bucketForLotStatus, summarizeUnits } from '@/lib/crm/projects'
import type { DeveloperContext } from './programs'

export const DASHBOARD_PERIODS = ['month', 'quarter', 'year'] as const
export type DashboardPeriod = (typeof DASHBOARD_PERIODS)[number]

export function isDashboardPeriod(v: unknown): v is DashboardPeriod {
  return typeof v === 'string' && (DASHBOARD_PERIODS as readonly string[]).includes(v)
}

/** A figure for the selected period next to the same figure for the one before it. */
export interface Delta<T = number> {
  value: T
  previous: T
}

export interface DeveloperDashboard {
  period: DashboardPeriod
  hasProjects: boolean
  kpis: {
    /** All-time value of units under contract or beyond. */
    totalSalesValue: number
    units: { total: number; available: number; reserved: number; sold: number }
    salesCount: Delta
    salesValue: Delta
    averageDealValue: Delta
    newLeads: Delta
    qualifiedLeads: Delta
    /** Percent of the period's new leads that now hold a unit; null with no leads. */
    conversionRate: Delta<number | null>
    /** Percent of the period's deals (sales + cancellations) that were cancelled. */
    cancellationRate: Delta<number | null>
    pipelineValue: number
    collected: number
    called: number
    outstanding: number
    overdueAmount: number
    target: { revenueTarget: number; achieved: number; percent: number | null }
  }
  series: {
    salesTrend: { month: string; count: number; value: number }[]
    salesByProject: { id: string; name: string; count: number; value: number }[]
    revenueVsTarget: { id: string; name: string; sold: number; target: number }[]
    salesByAgent: { id: string | null; name: string | null; count: number; value: number }[]
    leadFunnel: { stage: string; count: number; value: number }[]
    inventory: {
      available: { count: number; value: number }
      reserved: { count: number; value: number }
      sold: { count: number; value: number }
    }
    collectionsForecast: { month: string; due: number }[]
    /** Value of sold units that has not been called for funds yet. */
    uncalledBalance: number
  }
  attention: {
    expiringOptions: {
      lotId: string
      lotNumber: string
      programId: string
      programName: string
      holder: string | null
      expiresAt: string
    }[]
    overdueCalls: {
      id: string
      callNumber: string
      lotNumber: string
      programId: string
      programName: string
      buyer: string | null
      amount: number
      dueAt: string | null
      daysOverdue: number
    }[]
    overdueCallsTotal: number
    pendingModifications: {
      id: string
      reference: string
      title: string
      status: string
      lotNumber: string
      programId: string
      programName: string
    }[]
    pendingModificationsTotal: number
  }
}

const DAY_MS = 24 * 60 * 60 * 1000
const OPTION_WARNING_MS = 72 * 60 * 60 * 1000

/** Calendar period containing `now`, and the one immediately before it (UTC). */
export function periodRanges(period: DashboardPeriod, now: Date) {
  const y = now.getUTCFullYear()
  const m = now.getUTCMonth()
  const months = period === 'month' ? 1 : period === 'quarter' ? 3 : 12
  const startMonth = period === 'year' ? 0 : period === 'quarter' ? m - (m % 3) : m
  const start = new Date(Date.UTC(y, startMonth, 1))
  const end = new Date(Date.UTC(y, startMonth + months, 1))
  const prevStart = new Date(Date.UTC(y, startMonth - months, 1))
  return { start, end, prevStart, prevEnd: start }
}

function monthKey(date: Date): string {
  return date.toISOString().slice(0, 7)
}

function inRange(date: Date, start: Date, end: Date): boolean {
  return date >= start && date < end
}

function percent(part: number, whole: number): number | null {
  return whole > 0 ? (part / whole) * 100 : null
}

function fullName(person: { firstName: string; lastName: string } | null | undefined): string | null {
  if (!person) return null
  return `${person.firstName} ${person.lastName}`.trim() || null
}

/**
 * Everything the developer home screen shows, in one round trip.
 *
 * A "sale" is a unit under contract or beyond (the 'sold' bucket in
 * lib/crm/projects). It is dated by when the contract was signed, falling back to
 * the reservation date and then the last update for units that predate those
 * columns, so history from before the dates were stamped still lands in a month
 * rather than vanishing from the trend.
 *
 * Reads a handful of narrow selects and aggregates in memory. A workspace's
 * stock is hundreds to a few thousand units, which is cheaper than the dozen
 * grouped queries it would take to answer the same questions in SQL.
 */
export async function getDeveloperDashboard(
  ctx: DeveloperContext,
  options: { period?: DashboardPeriod; now?: Date } = {}
): Promise<DeveloperDashboard> {
  const period = options.period ?? 'month'
  const now = options.now ?? new Date()
  const { start, end, prevStart, prevEnd } = periodRanges(period, now)
  const workspaceId = ctx.workspaceId

  // Twelve calendar months ending with this one, for the trend.
  const trendStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 11, 1))

  const [programs, lots, cancellations, calls, leads, boardPipeline, tmaPending, tmaPendingTotal] =
    await Promise.all([
      prisma.program.findMany({
        where: { workspaceId },
        select: { id: true, name: true, revenueTarget: true },
      }),
      prisma.developmentLot.findMany({
        where: { workspaceId },
        select: {
          id: true,
          lotNumber: true,
          status: true,
          totalPrice: true,
          basePrice: true,
          programId: true,
          salesAgentId: true,
          reservedAt: true,
          contractSignedAt: true,
          updatedAt: true,
          optionExpiresAt: true,
          program: { select: { name: true } },
          optionHolderLead: { select: { firstName: true, lastName: true } },
        },
      }),
      prisma.lotCancellation.findMany({
        where: { workspaceId, cancelledAt: { gte: prevStart } },
        select: { cancelledAt: true },
      }),
      prisma.callForFunds.findMany({
        where: { workspaceId, status: { not: 'draft' } },
        select: {
          id: true,
          callNumber: true,
          amount: true,
          status: true,
          dueAt: true,
          lotId: true,
          lot: {
            select: {
              lotNumber: true,
              programId: true,
              program: { select: { name: true } },
              buyerLead: { select: { firstName: true, lastName: true } },
            },
          },
        },
      }),
      prisma.lead.findMany({
        where: { pipeline: { workspaceId, name: DEVELOPER_SALES_PIPELINE.name } },
        select: {
          stage: true,
          value: true,
          createdAt: true,
          _count: { select: { boughtLots: true } },
        },
      }),
      prisma.pipeline.findFirst({
        where: { workspaceId, name: DEVELOPER_SALES_PIPELINE.name },
        select: { stages: true },
      }),
      prisma.tMARequest.findMany({
        where: { workspaceId, status: { in: ['requested', 'feasibility_approved'] } },
        select: {
          id: true,
          reference: true,
          title: true,
          status: true,
          lot: { select: { lotNumber: true, programId: true, program: { select: { name: true } } } },
        },
        orderBy: { createdAt: 'asc' },
        take: 8,
      }),
      prisma.tMARequest.count({
        where: { workspaceId, status: { in: ['requested', 'feasibility_approved'] } },
      }),
    ])

  // ── Units ──────────────────────────────────────────────────────────────────
  const unitTotals = summarizeUnits(lots)

  const saleDate = (lot: (typeof lots)[number]) => lot.contractSignedAt ?? lot.reservedAt ?? lot.updatedAt
  const soldLots = lots.filter((l) => bucketForLotStatus(l.status) === 'sold')
  const priceOf = (l: (typeof lots)[number]) => l.totalPrice ?? l.basePrice ?? 0

  const salesIn = (from: Date, to: Date) => soldLots.filter((l) => inRange(saleDate(l), from, to))
  const sales = salesIn(start, end)
  const prevSales = salesIn(prevStart, prevEnd)
  const sum = (rows: typeof soldLots) => rows.reduce((total, l) => total + priceOf(l), 0)

  const salesValue = sum(sales)
  const prevSalesValue = sum(prevSales)

  // ── Cancellations ──────────────────────────────────────────────────────────
  const cancelledIn = (from: Date, to: Date) =>
    cancellations.filter((c) => inRange(c.cancelledAt, from, to)).length
  const cancelled = cancelledIn(start, end)
  const prevCancelled = cancelledIn(prevStart, prevEnd)

  // ── Leads ──────────────────────────────────────────────────────────────────
  const stages = parseStages(boardPipeline?.stages)
  const stageIndex = (stage: string) => stages.indexOf(stage)
  const lostStage = DEVELOPER_SALES_PIPELINE.stages[DEVELOPER_SALES_PIPELINE.stages.length - 1]
  const isQualified = (stage: string) =>
    stage !== lostStage && stageIndex(stage) >= DEVELOPER_QUALIFIED_FROM_INDEX

  const leadsIn = (from: Date, to: Date) => leads.filter((l) => inRange(l.createdAt, from, to))
  const newLeads = leadsIn(start, end)
  const prevNewLeads = leadsIn(prevStart, prevEnd)
  const converted = (rows: typeof leads) => rows.filter((l) => l._count.boughtLots > 0).length

  const openStages = new Set(DEVELOPER_OPEN_STAGES)
  const pipelineValue = leads
    .filter((l) => openStages.has(l.stage))
    .reduce((total, l) => total + (l.value ?? 0), 0)

  const leadFunnel = stages.map((stage) => {
    const here = leads.filter((l) => l.stage === stage)
    return { stage, count: here.length, value: here.reduce((t, l) => t + (l.value ?? 0), 0) }
  })

  // ── Collections ────────────────────────────────────────────────────────────
  const isPaid = (c: (typeof calls)[number]) => c.status === 'paid'
  const isOverdue = (c: (typeof calls)[number]) =>
    !isPaid(c) && (c.status === 'overdue' || (c.dueAt !== null && c.dueAt < now))

  const collected = calls.filter(isPaid).reduce((t, c) => t + c.amount, 0)
  const called = calls.reduce((t, c) => t + c.amount, 0)
  const outstanding = called - collected
  const overdueRows = calls.filter(isOverdue)
  const overdueAmount = overdueRows.reduce((t, c) => t + c.amount, 0)

  // The next six months, starting with this one.
  const forecastMonths = Array.from({ length: 6 }, (_, i) =>
    monthKey(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + i, 1)))
  )
  const dueByMonth = new Map(forecastMonths.map((m) => [m, 0]))
  for (const call of calls) {
    if (isPaid(call) || !call.dueAt) continue
    // Overdue money is still expected: it lands in this month's bar rather than
    // disappearing from a forward-looking chart.
    const key = call.dueAt < now ? forecastMonths[0] : monthKey(call.dueAt)
    if (dueByMonth.has(key)) dueByMonth.set(key, (dueByMonth.get(key) ?? 0) + call.amount)
  }
  const uncalledBalance = Math.max(0, unitTotals.soldValue - called)

  // ── Series ─────────────────────────────────────────────────────────────────
  const trendMonths = Array.from({ length: 12 }, (_, i) =>
    monthKey(new Date(Date.UTC(trendStart.getUTCFullYear(), trendStart.getUTCMonth() + i, 1)))
  )
  const trend = new Map(trendMonths.map((m) => [m, { count: 0, value: 0 }]))
  for (const lot of soldLots) {
    const bucket = trend.get(monthKey(saleDate(lot)))
    if (bucket) {
      bucket.count += 1
      bucket.value += priceOf(lot)
    }
  }

  const programName = new Map(programs.map((p) => [p.id, p.name]))
  const byProject = new Map<string, { count: number; value: number }>()
  const soldByProjectAllTime = new Map<string, number>()
  for (const lot of soldLots) {
    soldByProjectAllTime.set(lot.programId, (soldByProjectAllTime.get(lot.programId) ?? 0) + priceOf(lot))
  }
  for (const lot of sales) {
    const row = byProject.get(lot.programId) ?? { count: 0, value: 0 }
    row.count += 1
    row.value += priceOf(lot)
    byProject.set(lot.programId, row)
  }

  const byAgent = new Map<string | null, { count: number; value: number }>()
  for (const lot of sales) {
    const row = byAgent.get(lot.salesAgentId) ?? { count: 0, value: 0 }
    row.count += 1
    row.value += priceOf(lot)
    byAgent.set(lot.salesAgentId, row)
  }
  const agentIds = [...byAgent.keys()].filter((id): id is string => id !== null)
  const agents = agentIds.length
    ? await prisma.user.findMany({
        where: { id: { in: agentIds } },
        select: { id: true, name: true, email: true },
      })
    : []
  const agentName = new Map(agents.map((a) => [a.id, a.name || a.email]))

  // ── Needs attention ────────────────────────────────────────────────────────
  const expiringOptions = lots
    .filter(
      (l) =>
        l.status === 'optioned' &&
        l.optionExpiresAt !== null &&
        l.optionExpiresAt.getTime() <= now.getTime() + OPTION_WARNING_MS
    )
    .sort((a, b) => a.optionExpiresAt!.getTime() - b.optionExpiresAt!.getTime())
    .slice(0, 8)
    .map((l) => ({
      lotId: l.id,
      lotNumber: l.lotNumber,
      programId: l.programId,
      programName: l.program.name,
      holder: fullName(l.optionHolderLead),
      expiresAt: l.optionExpiresAt!.toISOString(),
    }))

  const overdueCalls = overdueRows
    .sort((a, b) => (a.dueAt?.getTime() ?? 0) - (b.dueAt?.getTime() ?? 0))
    .slice(0, 8)
    .map((c) => ({
      id: c.id,
      callNumber: c.callNumber,
      lotNumber: c.lot.lotNumber,
      programId: c.lot.programId,
      programName: c.lot.program.name,
      buyer: fullName(c.lot.buyerLead),
      amount: c.amount,
      dueAt: c.dueAt ? c.dueAt.toISOString() : null,
      daysOverdue: c.dueAt ? Math.max(0, Math.floor((now.getTime() - c.dueAt.getTime()) / DAY_MS)) : 0,
    }))

  const revenueTargetTotal = programs.reduce((t, p) => t + (p.revenueTarget ?? 0), 0)

  return {
    period,
    hasProjects: programs.length > 0,
    kpis: {
      totalSalesValue: unitTotals.soldValue,
      units: {
        total: unitTotals.total,
        available: unitTotals.available,
        reserved: unitTotals.reserved,
        sold: unitTotals.sold,
      },
      salesCount: { value: sales.length, previous: prevSales.length },
      salesValue: { value: salesValue, previous: prevSalesValue },
      averageDealValue: {
        value: sales.length ? salesValue / sales.length : 0,
        previous: prevSales.length ? prevSalesValue / prevSales.length : 0,
      },
      newLeads: { value: newLeads.length, previous: prevNewLeads.length },
      qualifiedLeads: {
        value: newLeads.filter((l) => isQualified(l.stage)).length,
        previous: prevNewLeads.filter((l) => isQualified(l.stage)).length,
      },
      conversionRate: {
        value: percent(converted(newLeads), newLeads.length),
        previous: percent(converted(prevNewLeads), prevNewLeads.length),
      },
      cancellationRate: {
        value: percent(cancelled, sales.length + cancelled),
        previous: percent(prevCancelled, prevSales.length + prevCancelled),
      },
      pipelineValue,
      collected,
      called,
      outstanding,
      overdueAmount,
      target: {
        revenueTarget: revenueTargetTotal,
        achieved: unitTotals.soldValue,
        percent: percent(unitTotals.soldValue, revenueTargetTotal),
      },
    },
    series: {
      salesTrend: trendMonths.map((month) => ({ month, ...trend.get(month)! })),
      salesByProject: [...byProject.entries()]
        .map(([id, row]) => ({ id, name: programName.get(id) ?? '', ...row }))
        .sort((a, b) => b.value - a.value),
      revenueVsTarget: programs
        .filter((p) => (p.revenueTarget ?? 0) > 0)
        .map((p) => ({
          id: p.id,
          name: p.name,
          sold: soldByProjectAllTime.get(p.id) ?? 0,
          target: p.revenueTarget ?? 0,
        })),
      salesByAgent: [...byAgent.entries()]
        .map(([id, row]) => ({ id, name: id ? agentName.get(id) ?? null : null, ...row }))
        .sort((a, b) => b.value - a.value),
      leadFunnel,
      inventory: {
        available: { count: unitTotals.available, value: unitTotals.availableValue },
        reserved: {
          count: unitTotals.reserved,
          value: lots
            .filter((l) => bucketForLotStatus(l.status) === 'reserved')
            .reduce((t, l) => t + priceOf(l), 0),
        },
        sold: { count: unitTotals.sold, value: unitTotals.soldValue },
      },
      collectionsForecast: forecastMonths.map((month) => ({ month, due: dueByMonth.get(month) ?? 0 })),
      uncalledBalance,
    },
    attention: {
      expiringOptions,
      overdueCalls,
      overdueCallsTotal: overdueRows.length,
      pendingModifications: tmaPending.map((t) => ({
        id: t.id,
        reference: t.reference,
        title: t.title,
        status: t.status,
        lotNumber: t.lot.lotNumber,
        programId: t.lot.programId,
        programName: t.lot.program.name,
      })),
      pendingModificationsTotal: tmaPendingTotal,
    },
  }
}
