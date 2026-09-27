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

const SUPPORTED_TRIGGER_TYPES = ['stage_changed']

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

    const toStage = conditions.toStage
    if (typeof toStage !== 'string' || toStage.trim().length === 0) {
      return { error: 'Trigger conditions must name the stage to enter (toStage)' }
    }

    const normalized: Record<string, string> = { toStage: toStage.trim() }
    if (typeof conditions.pipelineId === 'string' && conditions.pipelineId.trim()) {
      normalized.pipelineId = conditions.pipelineId.trim()
    }
    if (typeof conditions.fromStage === 'string' && conditions.fromStage.trim()) {
      normalized.fromStage = conditions.fromStage.trim()
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
