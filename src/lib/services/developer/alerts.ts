import { prisma } from '@/lib/prisma'
import { notify } from '@/lib/notifications/notify'
import { workspaceAdminIds } from '@/lib/notifications/recipients'
import {
  ALERT_RULES,
  cancellationsHigh,
  dayKey,
  inventoryLow,
  isAlertRuleType,
  leadNeedsFollowUp,
  leadNeedsResponseAlert,
  monthKeyOf,
  NO_RESPONSE_LOOKBACK_MS,
  projectBehindTarget,
  expectedSoldUnits,
  resolveParams,
  validateParams,
  weekKey,
  type AlertRuleType,
  type RuleParams,
} from '@/lib/crm/alert-rules'
import { DEVELOPER_SALES_PIPELINE, DEVELOPER_STAGE_LOST, DEVELOPER_STAGE_WON } from '@/lib/crm/lifecycle'
import { ServiceError } from '../errors'
import type { DeveloperContext } from './programs'
import { createTask } from './tasks'
import { autoTaskTitle } from '@/lib/crm/task-titles'

/**
 * Automatic alerts for a developer's sales team.
 *
 * Every alert goes through one gate, `claim`: a row in AlertFiring that is unique
 * for the rule and the subject (a lead, or a project and a week). The row is
 * written before anyone is told, so two overlapping runs of the job, or an event
 * raised twice, tell people once. If telling them then fails, the claim stands: a
 * missed alert is better than the same alert every minute.
 *
 * The rules themselves (thresholds, boundaries) are pure and live in
 * lib/crm/alert-rules. This file gathers the facts they need and acts on the answer.
 */

export interface AlertRuleView {
  type: AlertRuleType
  enabled: boolean
  params: RuleParams
  lastFiredAt: string | null
}

const DAY_MS = 24 * 60 * 60 * 1000
const BATCH = 500

/** Contact that counts as "someone has responded to this lead". */
const CONTACT_ACTIVITY_TYPES = ['call_logged', 'site_visit_booked', 'task_completed']

type RuleSettings = Map<AlertRuleType, { enabled: boolean; params: RuleParams }>

/** A workspace's rules: what it saved, over the defaults for everything it did not. */
async function loadSettings(workspaceIds: string[]): Promise<Map<string, RuleSettings>> {
  const rows = workspaceIds.length
    ? await prisma.alertRule.findMany({ where: { workspaceId: { in: workspaceIds } } })
    : []
  const byWorkspace = new Map<string, RuleSettings>()
  for (const workspaceId of workspaceIds) {
    const settings: RuleSettings = new Map()
    for (const type of ALERT_RULES) settings.set(type, { enabled: true, params: resolveParams(type, undefined) })
    byWorkspace.set(workspaceId, settings)
  }
  for (const row of rows) {
    if (!isAlertRuleType(row.type)) continue
    byWorkspace.get(row.workspaceId)?.set(row.type, { enabled: row.enabled, params: resolveParams(row.type, row.params) })
  }
  return byWorkspace
}

export async function getRules(workspaceId: string): Promise<AlertRuleView[]> {
  const [settings, fired] = await Promise.all([
    loadSettings([workspaceId]),
    prisma.alertFiring.groupBy({ by: ['ruleType'], where: { workspaceId }, _max: { firedAt: true } }),
  ])
  const mine = settings.get(workspaceId)!
  const lastFired = new Map(fired.map((f) => [f.ruleType, f._max.firedAt]))
  return ALERT_RULES.map((type) => ({
    type,
    enabled: mine.get(type)!.enabled,
    params: mine.get(type)!.params,
    lastFiredAt: lastFired.get(type)?.toISOString() ?? null,
  }))
}

/**
 * Save one rule. Owners and admins only: an alert is a standing instruction to the
 * whole team's notifications, not a personal preference.
 */
export async function saveRule(ctx: DeveloperContext & { canModerate: boolean }, input: Record<string, unknown>) {
  if (!ctx.canModerate) throw new ServiceError('Only an owner or admin can change alerts', 403)
  if (!isAlertRuleType(input.type)) throw new ServiceError('Unknown alert')
  if (typeof input.enabled !== 'boolean') throw new ServiceError('Say whether the alert is on')

  const checked = validateParams(input.type, input.params)
  if (!checked.ok) throw new ServiceError(checked.message)

  return prisma.alertRule.upsert({
    where: { workspaceId_type: { workspaceId: ctx.workspaceId, type: input.type } },
    update: { enabled: input.enabled, params: checked.params },
    create: { workspaceId: ctx.workspaceId, type: input.type, enabled: input.enabled, params: checked.params },
  })
}

/**
 * Take the right to raise an alert for this subject. True if this call took it,
 * false if it was already taken: the unique key is the arbiter, not a read.
 */
async function claim(workspaceId: string, ruleType: AlertRuleType, subjectKey: string): Promise<boolean> {
  try {
    await prisma.alertFiring.create({ data: { workspaceId, ruleType, subjectKey } })
    return true
  } catch (error: any) {
    if (error?.code === 'P2002') return false
    throw error
  }
}

const fullName = (p: { firstName: string; lastName: string }) => `${p.firstName} ${p.lastName}`.trim()

// ─── Lead alerts (every minute) ──────────────────────────────────────────────

const inDeveloperBoard = {
  pipeline: { name: DEVELOPER_SALES_PIPELINE.name, workspace: { owner: { businessType: 'DEVELOPER' as const } } },
}

export interface AlertRunResult { considered: number; fired: number; failed: number }

export async function evaluateLeadAlerts(now: Date = new Date()): Promise<AlertRunResult> {
  const result: AlertRunResult = { considered: 0, fired: 0, failed: 0 }

  // ── No response ──
  const fresh = await prisma.lead.findMany({
    where: {
      ...inDeveloperBoard,
      createdAt: { gte: new Date(now.getTime() - NO_RESPONSE_LOOKBACK_MS), lte: now },
      lastContactedAt: null,
    },
    orderBy: { createdAt: 'asc' },
    take: BATCH,
    select: {
      id: true, firstName: true, lastName: true, createdAt: true, ownerId: true,
      pipeline: { select: { workspaceId: true } },
    },
  })

  // Logged contact that does not set lastContactedAt (an unanswered call, a booked
  // visit) still means someone is on it.
  const touched = fresh.length
    ? await prisma.activity.groupBy({
        by: ['leadId'],
        where: { leadId: { in: fresh.map((l) => l.id) }, type: { in: CONTACT_ACTIVITY_TYPES } },
      })
    : []
  const touchedSet = new Set(touched.map((t) => t.leadId))

  const workspaceIds = [...new Set(fresh.map((l) => l.pipeline.workspaceId))]
  const settings = await loadSettings(workspaceIds)

  for (const lead of fresh) {
    result.considered++
    const rule = settings.get(lead.pipeline.workspaceId)!.get('lead_no_response')!
    if (!rule.enabled) continue
    if (!leadNeedsResponseAlert({ createdAt: lead.createdAt, now, minutes: rule.params.minutes, hasContact: touchedSet.has(lead.id) })) continue

    try {
      const workspaceId = lead.pipeline.workspaceId
      if (!(await claim(workspaceId, 'lead_no_response', lead.id))) continue
      const admins = await workspaceAdminIds(workspaceId)
      await notify({
        recipients: [...admins, ...(lead.ownerId ? [lead.ownerId] : [])],
        type: 'alerts.lead_no_response',
        workspaceId,
        title: `${fullName(lead)} has not been contacted`,
        body: `A new buyer arrived over ${rule.params.minutes} minutes ago and nobody has logged a call, a visit or a follow-up.`,
        href: `/crm?workspace=${workspaceId}&lead=${lead.id}&tab=customer`,
        dedupeKey: `alert.lead_no_response:${lead.id}`,
      })
      result.fired++
    } catch (error) {
      result.failed++
      console.error('[alerts] no-response failed for lead', lead.id, error)
    }
  }

  // ── No follow-up ──
  // The database narrows to "owned, open, nothing booked, quiet for at least the
  // shortest allowed setting"; each workspace's own number then decides.
  const quietSince = new Date(now.getTime() - DAY_MS)
  const quiet = await prisma.lead.findMany({
    where: {
      ...inDeveloperBoard,
      ownerId: { not: null },
      nextFollowUpAt: null,
      stage: { notIn: [DEVELOPER_STAGE_WON, DEVELOPER_STAGE_LOST] },
      OR: [{ lastContactedAt: { lt: quietSince } }, { lastContactedAt: null, createdAt: { lt: quietSince } }],
    },
    orderBy: { updatedAt: 'asc' },
    take: BATCH,
    select: {
      id: true, firstName: true, lastName: true, createdAt: true, lastContactedAt: true, ownerId: true,
      pipeline: { select: { workspaceId: true } },
    },
  })
  const quietSettings = await loadSettings([...new Set(quiet.map((l) => l.pipeline.workspaceId))])

  for (const lead of quiet) {
    result.considered++
    const workspaceId = lead.pipeline.workspaceId
    const rule = quietSettings.get(workspaceId)!.get('lead_no_followup')!
    if (!rule.enabled) continue
    if (!leadNeedsFollowUp({
      lastTouchAt: lead.lastContactedAt ?? lead.createdAt,
      now,
      days: rule.params.days,
      hasOpenTask: false,
      hasOwner: !!lead.ownerId,
      finished: false,
    })) continue

    try {
      // Once a day at most: creating the task clears the condition, but completing a
      // task that is not a real contact would otherwise let it re-trigger at once.
      if (!(await claim(workspaceId, 'lead_no_followup', `${lead.id}:${dayKey(now)}`))) continue
      const name = fullName(lead)
      await createTask(
        { workspaceId, userId: lead.ownerId! },
        { leadId: lead.id, type: 'follow_up', title: autoTaskTitle('followUpWith', { name }), dueAt: now, assigneeId: lead.ownerId }
      )
      await notify({
        recipients: [lead.ownerId!],
        type: 'alerts.lead_no_followup',
        workspaceId,
        title: `Follow up with ${name}`,
        body: `Nothing has been booked with this buyer for ${rule.params.days} days, so a follow-up was added for you.`,
        href: `/developer/tasks?workspace=${workspaceId}`,
        dedupeKey: `alert.lead_no_followup:${lead.id}:${dayKey(now)}`,
      })
      result.fired++
    } catch (error) {
      result.failed++
      console.error('[alerts] no-follow-up failed for lead', lead.id, error)
    }
  }

  return result
}

// ─── Project alerts (hourly) ─────────────────────────────────────────────────

const SELLING_STATUSES = ['commercialization', 'construction']
const CANCELLATION_WINDOW_DAYS = 90
const SOLD_STATUSES = ['contract_signed', 'deed_signed', 'delivered']

export async function evaluateProjectAlerts(now: Date = new Date()): Promise<AlertRunResult> {
  const result: AlertRunResult = { considered: 0, fired: 0, failed: 0 }

  const programs = await prisma.program.findMany({
    where: { status: { in: SELLING_STATUSES }, workspace: { owner: { businessType: 'DEVELOPER' } } },
    take: BATCH,
    select: {
      id: true, name: true, workspaceId: true, totalUnits: true, availableUnits: true, soldUnits: true,
      salesTargetUnits: true, launchDate: true, targetDeliveryDate: true,
    },
  })
  if (programs.length === 0) return result

  const settings = await loadSettings([...new Set(programs.map((p) => p.workspaceId))])
  const since = new Date(now.getTime() - CANCELLATION_WINDOW_DAYS * DAY_MS)
  const ids = programs.map((p) => p.id)

  const [cancelled, soldRecently] = await Promise.all([
    prisma.lotCancellation.groupBy({ by: ['programId'], where: { programId: { in: ids }, cancelledAt: { gte: since } }, _count: { _all: true } }),
    prisma.developmentLot.groupBy({
      by: ['programId'],
      where: {
        programId: { in: ids },
        status: { in: SOLD_STATUSES },
        OR: [{ contractSignedAt: { gte: since } }, { contractSignedAt: null, updatedAt: { gte: since } }],
      },
      _count: { _all: true },
    }),
  ])
  const cancelledBy = new Map(cancelled.map((c) => [c.programId, c._count._all]))
  const soldBy = new Map(soldRecently.map((c) => [c.programId, c._count._all]))

  for (const program of programs) {
    result.considered++
    const rules = settings.get(program.workspaceId)!
    const alert = async (type: AlertRuleType, key: string, title: string, body: string, href: string) => {
      try {
        if (!(await claim(program.workspaceId, type, key))) return
        await notify({
          recipients: await workspaceAdminIds(program.workspaceId),
          type: `alerts.${type}` as 'alerts.project_behind_target',
          workspaceId: program.workspaceId,
          title,
          body,
          href,
          dedupeKey: `alert.${type}:${key}`,
        })
        result.fired++
      } catch (error) {
        result.failed++
        console.error(`[alerts] ${type} failed for project`, program.id, error)
      }
    }
    const projectHref = `/developer/programs/${program.id}?workspace=${program.workspaceId}`

    const behind = rules.get('project_behind_target')!
    if (behind.enabled) {
      const input = {
        soldUnits: program.soldUnits,
        targetUnits: program.salesTargetUnits,
        launchDate: program.launchDate,
        endDate: program.targetDeliveryDate,
        now,
        tolerancePercent: behind.params.tolerancePercent,
      }
      if (projectBehindTarget(input)) {
        await alert(
          'project_behind_target',
          `${program.id}:${weekKey(now)}`,
          `${program.name} is behind its sales target`,
          `${program.soldUnits} of ${program.salesTargetUnits} units sold; the plan expected about ${expectedSoldUnits(input)} by now.`,
          projectHref
        )
      }
    }

    const low = rules.get('low_inventory')!
    if (low.enabled && inventoryLow({ available: program.availableUnits, total: program.totalUnits, minPercent: low.params.minAvailablePercent })) {
      await alert(
        'low_inventory',
        `${program.id}:${monthKeyOf(now)}`,
        `${program.name} is running low on stock`,
        `Only ${program.availableUnits} of ${program.totalUnits} units are still available.`,
        projectHref
      )
    }

    const cancels = rules.get('high_cancellations')!
    const c = cancelledBy.get(program.id) ?? 0
    const s = soldBy.get(program.id) ?? 0
    if (cancels.enabled && cancellationsHigh({ cancellations: c, sold: s, ratePercent: cancels.params.ratePercent, minDeals: cancels.params.minDeals })) {
      await alert(
        'high_cancellations',
        `${program.id}:${monthKeyOf(now)}`,
        `${program.name} has a high cancellation rate`,
        `${c} of ${c + s} deals in the last ${CANCELLATION_WINDOW_DAYS} days were cancelled.`,
        `/developer/reports?workspace=${program.workspaceId}`
      )
    }
  }

  return result
}

// ─── Events raised by a sale ─────────────────────────────────────────────────

/**
 * Tell the managers that a unit has been reserved, or has gone under contract.
 *
 * The key includes the moment the event happened, so a unit that is reserved,
 * cancelled and reserved again alerts for each reservation, while the same
 * reservation reported twice (a retried request) alerts once. The person who did it
 * is left out: they know.
 */
export async function fireLotEvent(
  workspaceId: string,
  event: 'reservation_created' | 'contract_signed',
  lotId: string,
  actorId?: string
): Promise<void> {
  const [lot, settings] = await Promise.all([
    prisma.developmentLot.findFirst({
      where: { id: lotId, workspaceId },
      select: {
        lotNumber: true, totalPrice: true, reservedAt: true, contractSignedAt: true, programId: true,
        program: { select: { name: true } },
        buyerLead: { select: { firstName: true, lastName: true } },
      },
    }),
    loadSettings([workspaceId]),
  ])
  if (!lot) return
  if (!settings.get(workspaceId)!.get(event)!.enabled) return

  const at = event === 'reservation_created' ? lot.reservedAt : lot.contractSignedAt
  const happenedAt = (at ?? currentTime()).toISOString()
  if (!(await claim(workspaceId, event, `${lotId}:${happenedAt}`))) return

  const buyer = lot.buyerLead ? fullName(lot.buyerLead) : 'a buyer'
  await notify({
    recipients: await workspaceAdminIds(workspaceId),
    type: `alerts.${event}` as 'alerts.reservation_created',
    workspaceId,
    actorId,
    title: event === 'reservation_created'
      ? `Unit ${lot.lotNumber} reserved in ${lot.program.name}`
      : `Unit ${lot.lotNumber} under contract in ${lot.program.name}`,
    body: `For ${buyer}.`,
    href: `/developer/programs/${lot.programId}?workspace=${workspaceId}`,
    dedupeKey: `alert.${event}:${lotId}:${happenedAt}`,
  })
}

const currentTime = () => new Date()
