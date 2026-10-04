import { prisma } from '@/lib/prisma'
import { DEFAULT_PIPELINES, parseStages } from '@/lib/crm/lifecycle'
import type { SubjectType } from '@/lib/crm/subjects'
import { ServiceError } from './errors'

/**
 * Make sure a workspace has the boards the product assumes: Contacts, Buyer
 * journey, and Owner / mandate (see DEFAULT_PIPELINES).
 *
 * Idempotent, and it only ever adds. A board is created for a subject type only
 * when the workspace has none of that type, so an agency that renamed or rebuilt
 * its own board keeps it. Called when a workspace is created; the
 * 20261007070000_seed_default_pipelines migration did the same for the
 * workspaces that already existed.
 */
export async function ensureDefaultPipelines(workspaceId: string): Promise<void> {
  const existing = await prisma.pipeline.findMany({
    where: { workspaceId },
    select: { subjectType: true, order: true },
  })

  const have = new Set(existing.map(p => p.subjectType))
  const missing = DEFAULT_PIPELINES.filter(p => !have.has(p.subjectType))
  if (missing.length === 0) return

  let order = existing.reduce((max, p) => Math.max(max, p.order), -1) + 1

  await prisma.pipeline.createMany({
    data: missing.map(p => ({
      workspaceId,
      name: p.name,
      subjectType: p.subjectType,
      stages: JSON.stringify(p.stages),
      order: order++,
    })),
  })
}

export interface Board {
  id: string
  stages: string[]
}

/**
 * The board a new record of `subjectType` should land on: the one the caller
 * named, or the workspace's first of that type. Creates the defaults when the
 * workspace has none, so a workspace made by a path that predates the defaults
 * (or whose board was deleted) still works instead of failing.
 */
export async function resolveBoard(
  workspaceId: string,
  subjectType: Extract<SubjectType, 'Lead' | 'Interest' | 'Property'>,
  pipelineId?: string | null
): Promise<Board> {
  if (pipelineId) {
    const pipeline = await prisma.pipeline.findFirst({
      where: { id: pipelineId, workspaceId, subjectType },
      select: { id: true, stages: true },
    })
    if (!pipeline) throw new ServiceError('Board not found in this workspace', 400)
    return { id: pipeline.id, stages: parseStages(pipeline.stages) }
  }

  const find = () =>
    prisma.pipeline.findFirst({
      where: { workspaceId, subjectType },
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
      select: { id: true, stages: true },
    })

  let pipeline = await find()
  if (!pipeline) {
    await ensureDefaultPipelines(workspaceId)
    pipeline = await find()
  }
  if (!pipeline) throw new ServiceError(`There is no ${subjectType.toLowerCase()} board in this workspace`, 400)

  return { id: pipeline.id, stages: parseStages(pipeline.stages) }
}
