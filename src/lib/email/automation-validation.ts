/**
 * Request validation for the automations API.
 *
 * Hand-rolled to match the rest of this codebase — `zod` is not a dependency.
 */

import { prisma } from '@/lib/prisma'

type Result<T> = { value: T } | { error: string }

export interface NormalizedTrigger {
  type: string
  conditions: string
  isActive: boolean
}

export interface NormalizedStep {
  order: number
  name: string
  description: string | null
  templateId: string | null
  delayMinutes: number
  sendCondition: string | null
}

const SUPPORTED_TRIGGER_TYPES = ['stage_changed', 'lead_created', 'mandate_expiring']

/** Cap a single step's delay at one year so a typo can't park an enrollment forever. */
const MAX_DELAY_MINUTES = 60 * 24 * 365

export function normalizeTriggers(input: unknown): Result<NormalizedTrigger[]> {
  if (input === undefined) return { value: [] }
  if (!Array.isArray(input)) return { error: 'Triggers must be an array' }

  const triggers: NormalizedTrigger[] = []

  for (const raw of input) {
    if (!raw || typeof raw !== 'object') return { error: 'Each trigger must be an object' }

    const type = (raw as any).type || 'stage_changed'
    if (!SUPPORTED_TRIGGER_TYPES.includes(type)) {
      return { error: `Unsupported trigger type: ${type}` }
    }

    const conditions = (raw as any).conditions
    if (!conditions || typeof conditions !== 'object') {
      return { error: 'Trigger conditions are required' }
    }

    const normalized: Record<string, unknown> = {}
    if (typeof conditions.pipelineId === 'string' && conditions.pipelineId.trim()) {
      normalized.pipelineId = conditions.pipelineId.trim()
    }

    if (type === 'stage_changed') {
      const toStage = conditions.toStage
      if (typeof toStage !== 'string' || toStage.trim().length === 0) {
        return { error: 'Trigger conditions must name the stage to enter (toStage)' }
      }
      normalized.toStage = toStage.trim()
      if (typeof conditions.fromStage === 'string' && conditions.fromStage.trim()) {
        normalized.fromStage = conditions.fromStage.trim()
      }
    } else if (type === 'lead_created') {
      // Fires when a subject is created: optionally only on one board, optionally
      // only when it matches criteria (the same shape the segment builder saves).
      if (conditions.criteria !== undefined) {
        const list = conditions.criteria
        const valid = Array.isArray(list) && list.every((c: any) => c && typeof c.field === 'string' && typeof c.operator === 'string')
        if (!valid) return { error: 'Criteria must be a list of conditions, each with a field and an operator' }
        if (list.length > 0) normalized.criteria = list
      }
    } else if (type === 'mandate_expiring') {
      const days = Number(conditions.withinDays ?? 30)
      if (!Number.isInteger(days) || days < 1 || days > 365) {
        return { error: 'withinDays must be a whole number of days between 1 and 365' }
      }
      normalized.withinDays = days
      // A mandate has no board, so a pipeline makes no sense here.
      delete normalized.pipelineId
    }

    triggers.push({
      type,
      conditions: JSON.stringify(normalized),
      isActive: (raw as any).isActive !== false,
    })
  }

  return { value: triggers }
}

/**
 * `order` is assigned from array position, so it always runs 0..n-1 and matches
 * the index the automation engine walks.
 */
export async function normalizeSteps(
  input: unknown,
  workspaceId: string
): Promise<Result<NormalizedStep[]>> {
  if (input === undefined) return { value: [] }
  if (!Array.isArray(input)) return { error: 'Steps must be an array' }

  const steps: NormalizedStep[] = []
  const templateIds: string[] = []

  for (const [index, raw] of input.entries()) {
    if (!raw || typeof raw !== 'object') return { error: 'Each step must be an object' }

    const name = (raw as any).name
    if (typeof name !== 'string' || name.trim().length === 0) {
      return { error: `Step ${index + 1} needs a name` }
    }

    const templateId = (raw as any).templateId
    if (templateId !== null && templateId !== undefined && typeof templateId !== 'string') {
      return { error: `Step ${index + 1} has an invalid template` }
    }
    if (typeof templateId === 'string' && templateId.trim()) {
      templateIds.push(templateId.trim())
    }

    const rawDelay = (raw as any).delayMinutes
    const delayMinutes = rawDelay === undefined || rawDelay === null || rawDelay === ''
      ? 0
      : Number(rawDelay)

    if (!Number.isFinite(delayMinutes) || delayMinutes < 0) {
      return { error: `Step ${index + 1} has an invalid delay` }
    }
    if (delayMinutes > MAX_DELAY_MINUTES) {
      return { error: `Step ${index + 1} delay cannot exceed one year` }
    }

    const sendCondition = (raw as any).sendCondition
    if (sendCondition !== undefined && sendCondition !== null && !Array.isArray(sendCondition)) {
      return { error: `Step ${index + 1} send condition must be a list of criteria` }
    }

    steps.push({
      order: index,
      name: name.trim().slice(0, 255),
      description: typeof (raw as any).description === 'string'
        ? (raw as any).description.trim() || null
        : null,
      templateId: typeof templateId === 'string' && templateId.trim() ? templateId.trim() : null,
      delayMinutes: Math.floor(delayMinutes),
      sendCondition: Array.isArray(sendCondition) && sendCondition.length > 0
        ? JSON.stringify(sendCondition)
        : null,
    })
  }

  // Templates are workspace-scoped; don't let one workspace reference another's.
  if (templateIds.length > 0) {
    const unique = Array.from(new Set(templateIds))
    const found = await prisma.emailTemplate.count({
      where: { id: { in: unique }, workspaceId },
    })
    if (found !== unique.length) {
      return { error: 'One or more templates do not belong to this workspace' }
    }
  }

  return { value: steps }
}

/**
 * The subject an automation enrolls, taken from the board its trigger watches.
 *
 * A stage_changed trigger names a pipeline, and what moves across a pipeline is
 * decided by the pipeline's subject type: leads, a buyer's interest in a property,
 * or properties. The automation inherits it, so there is no separate field to
 * contradict the trigger -- an automation watching the buyer journey enrolls
 * interests, once per interest, which is what lets one buyer sit in a
 * viewing-follow-up sequence twice.
 *
 * Returns null when no trigger names a pipeline, so the automation keeps its
 * current subject. Rejects a pipeline from another workspace.
 */
export async function automationSubjectFromTriggers(
  workspaceId: string,
  triggers: NormalizedTrigger[]
): Promise<{ value: string | null } | { error: string }> {
  // A mandate_expiring trigger is about mandates and nothing else.
  if (triggers.some(t => t.type === 'mandate_expiring')) {
    if (triggers.some(t => t.type !== 'mandate_expiring')) {
      return { error: 'An automation that watches mandate expiry cannot also watch other events' }
    }
    return { value: 'Mandate' }
  }

  const ids = new Set<string>()
  for (const trigger of triggers) {
    try {
      const pipelineId = JSON.parse(trigger.conditions)?.pipelineId
      if (typeof pipelineId === 'string') ids.add(pipelineId)
    } catch {
      // normalizeTriggers produced this string, so it parses; keep the guard anyway.
    }
  }
  // A lead_created trigger with no board is about new contacts.
  if (ids.size === 0) return { value: triggers.some(t => t.type === 'lead_created') ? 'Lead' : null }

  const pipelines = await prisma.pipeline.findMany({
    where: { id: { in: Array.from(ids) }, workspaceId },
    select: { id: true, subjectType: true },
  })
  if (pipelines.length !== ids.size) return { error: 'Board not found in this workspace' }

  const subjects = new Set(pipelines.map(p => p.subjectType))
  if (subjects.size > 1) {
    return { error: 'An automation can only watch boards of one kind' }
  }
  return { value: pipelines[0].subjectType }
}
