import { prisma } from '@/lib/prisma'
import type { DeveloperContext } from './programs'
import { periodRanges, type DashboardPeriod, type Delta } from './dashboard'

export interface AgentActivity {
  userId: string
  name: string
  callsMade: Delta
  callsAnswered: Delta
  visitsScheduled: Delta
  visitsAttended: Delta
  followUpsCompleted: Delta
  leadsAssigned: Delta
  dealsCreated: Delta
  dealsClosed: Delta
  /** A snapshot of right now, not of the period: what is late today. */
  followUpsOverdue: number
}

export interface TeamActivity {
  period: DashboardPeriod
  agents: AgentActivity[]
  /** One row per step, workspace-wide, for the period. */
  funnel: { key: 'leads' | 'visits' | 'reservations' | 'contracts' | 'paid'; count: number }[]
}

/**
 * What each salesperson actually did, so "I do not have enough leads" can be told
 * apart from "I am not following up the ones I have".
 *
 * Counts only what is recorded. Calls are the ones people logged. Emails and
 * WhatsApp are absent on purpose: a one-off email carries no sender and WhatsApp
 * is not connected, so any number here would be a guess presented as a measurement.
 *
 * Reads one narrow query per source over the previous and current period
 * together and splits them in memory, which is cheaper than twice the queries and
 * keeps both halves of every delta on exactly the same data.
 */
export async function getTeamActivity(
  ctx: DeveloperContext,
  options: { period?: DashboardPeriod; now?: Date } = {}
): Promise<TeamActivity> {
  const period = options.period ?? 'month'
  const now = options.now ?? new Date()
  const { start, end, prevStart, prevEnd } = periodRanges(period, now)
  const workspaceId = ctx.workspaceId

  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: {
      owner: { select: { id: true, name: true, email: true } },
      members: { where: { role: { not: 'viewer' } }, select: { user: { select: { id: true, name: true, email: true } } } },
    },
  })
  const people = new Map<string, string>()
  if (workspace) {
    people.set(workspace.owner.id, workspace.owner.name || workspace.owner.email)
    for (const m of workspace.members) people.set(m.user.id, m.user.name || m.user.email)
  }

  const [calls, visits, doneTasks, overdueTasks, leads, reserved, contracted, paid] = await Promise.all([
    prisma.activity.findMany({
      where: { workspaceId, type: 'call_logged', createdAt: { gte: prevStart, lt: end } },
      select: { userId: true, createdAt: true, metadata: true },
    }),
    prisma.meeting.findMany({
      where: { workspaceId, programId: { not: null }, startTime: { gte: prevStart, lt: end }, status: { not: 'cancelled' } },
      select: { userId: true, startTime: true, status: true },
    }),
    prisma.leadTask.findMany({
      where: { workspaceId, completedAt: { gte: prevStart, lt: end } },
      select: { assigneeId: true, completedAt: true },
    }),
    prisma.leadTask.groupBy({
      by: ['assigneeId'],
      where: { workspaceId, completedAt: null, dueAt: { lt: now } },
      _count: { _all: true },
    }),
    prisma.lead.findMany({
      where: { pipeline: { workspaceId }, createdAt: { gte: prevStart, lt: end } },
      select: { ownerId: true, createdAt: true },
    }),
    prisma.developmentLot.findMany({
      where: { workspaceId, reservedAt: { gte: prevStart, lt: end } },
      select: { salesAgentId: true, reservedAt: true },
    }),
    prisma.developmentLot.findMany({
      where: { workspaceId, contractSignedAt: { gte: prevStart, lt: end } },
      select: { salesAgentId: true, contractSignedAt: true },
    }),
    prisma.callForFunds.count({ where: { workspaceId, status: 'paid', paidAt: { gte: start, lt: end } } }),
  ])

  const inCurrent = (d: Date) => d >= start && d < end
  const inPrevious = (d: Date) => d >= prevStart && d < prevEnd

  /** Count of rows per user whose date falls in each half, filtered by `keep`. */
  function tally<T>(rows: T[], user: (r: T) => string | null, date: (r: T) => Date, keep: (r: T) => boolean = () => true) {
    const out = new Map<string, Delta>()
    for (const row of rows) {
      const id = user(row)
      if (!id || !keep(row)) continue
      const d = date(row)
      const entry = out.get(id) ?? { value: 0, previous: 0 }
      if (inCurrent(d)) entry.value += 1
      else if (inPrevious(d)) entry.previous += 1
      out.set(id, entry)
    }
    return out
  }

  const answered = (metadata: string | null) => {
    try {
      return metadata ? JSON.parse(metadata).answered === true : false
    } catch {
      return false
    }
  }

  const callsMade = tally(calls, (r) => r.userId, (r) => r.createdAt)
  const callsAnswered = tally(calls, (r) => r.userId, (r) => r.createdAt, (r) => answered(r.metadata))
  const visitsScheduled = tally(visits, (r) => r.userId, (r) => r.startTime)
  const visitsAttended = tally(visits, (r) => r.userId, (r) => r.startTime, (r) => r.status === 'completed')
  const tasksDone = tally(doneTasks, (r) => r.assigneeId, (r) => r.completedAt!)
  const leadsAssigned = tally(leads, (r) => r.ownerId, (r) => r.createdAt)
  const dealsCreated = tally(reserved, (r) => r.salesAgentId, (r) => r.reservedAt!)
  const dealsClosed = tally(contracted, (r) => r.salesAgentId, (r) => r.contractSignedAt!)
  const overdue = new Map(overdueTasks.map((t) => [t.assigneeId, t._count._all]))

  const zero = (m: Map<string, Delta>, id: string): Delta => m.get(id) ?? { value: 0, previous: 0 }

  const agents: AgentActivity[] = [...people.entries()].map(([userId, name]) => ({
    userId,
    name,
    callsMade: zero(callsMade, userId),
    callsAnswered: zero(callsAnswered, userId),
    visitsScheduled: zero(visitsScheduled, userId),
    visitsAttended: zero(visitsAttended, userId),
    followUpsCompleted: zero(tasksDone, userId),
    leadsAssigned: zero(leadsAssigned, userId),
    dealsCreated: zero(dealsCreated, userId),
    dealsClosed: zero(dealsClosed, userId),
    followUpsOverdue: overdue.get(userId) ?? 0,
  }))

  // Busiest first, so the people carrying the team are at the top.
  agents.sort(
    (a, b) =>
      b.dealsClosed.value - a.dealsClosed.value ||
      b.dealsCreated.value - a.dealsCreated.value ||
      b.callsMade.value - a.callsMade.value ||
      a.name.localeCompare(b.name)
  )

  const countIn = <T,>(rows: T[], date: (r: T) => Date, keep: (r: T) => boolean = () => true) =>
    rows.filter((r) => keep(r) && inCurrent(date(r))).length

  return {
    period,
    agents,
    funnel: [
      { key: 'leads', count: countIn(leads, (r) => r.createdAt) },
      { key: 'visits', count: countIn(visits, (r) => r.startTime, (r) => r.status === 'completed') },
      { key: 'reservations', count: countIn(reserved, (r) => r.reservedAt!) },
      { key: 'contracts', count: countIn(contracted, (r) => r.contractSignedAt!) },
      { key: 'paid', count: paid },
    ],
  }
}
