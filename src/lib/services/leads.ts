import { prisma } from '@/lib/prisma'
import { ServiceError } from './errors'

type PipelineRecord = { id: string; workspaceId: string; stages: string }

export interface CreateLeadInput {
  firstName: string
  lastName: string
  email?: string | null
  phone?: string | null
  company?: string | null
  position?: string | null
  status?: string | null
  stage?: string | null
  value?: unknown
  source?: string | null
  notes?: string | null
  tags?: unknown
  leadListIds?: unknown
}

/**
 * Create a lead in `pipeline`. The caller must already have checked that the
 * user may create content in the pipeline's workspace.
 */
export async function createLead(pipeline: PipelineRecord, input: CreateLeadInput) {
  const { firstName, lastName, email, phone, company, position, status, stage, value, source, notes, tags, leadListIds } = input

  // Lead lists must belong to the same workspace as the pipeline
  const listIds: string[] = Array.isArray(leadListIds)
    ? Array.from(new Set(leadListIds.filter((id): id is string => typeof id === 'string')))
    : []
  if (listIds.length > 0) {
    const validLists = await prisma.leadList.count({
      where: { id: { in: listIds }, workspaceId: pipeline.workspaceId },
    })
    if (validLists !== listIds.length) {
      throw new ServiceError('Invalid lead list')
    }
  }

  const parsedValue = value === undefined || value === null || value === ''
    ? null
    : parseFloat(String(value))

  if (parsedValue !== null && isNaN(parsedValue)) {
    throw new ServiceError('Invalid value')
  }

  // Default to the pipeline's first stage. The old default was a lowercase
  // "new", which matches no column on a default pipeline ("New"), so the lead
  // was saved but never shown on the board.
  let firstStage = 'new'
  try {
    const parsed = JSON.parse(pipeline.stages)
    if (Array.isArray(parsed) && typeof parsed[0] === 'string') firstStage = parsed[0]
  } catch {
    // keep the fallback
  }

  // Get the highest order for this pipeline
  const highestOrder = await prisma.lead.findFirst({
    where: { pipelineId: pipeline.id },
    orderBy: { order: 'desc' },
    select: { order: true },
  })

  const lead = await prisma.lead.create({
    data: {
      firstName,
      lastName,
      email,
      phone,
      company,
      position,
      status: status || 'new',
      stage: stage || firstStage,
      value: parsedValue,
      source,
      notes,
      tags: Array.isArray(tags) && tags.length > 0 ? JSON.stringify(tags) : null,
      pipelineId: pipeline.id,
      order: (highestOrder?.order ?? 0) + 1,
    },
  })

  if (listIds.length > 0) {
    await prisma.leadListLead.createMany({
      data: listIds.map((leadListId) => ({ leadId: lead.id, leadListId })),
    })
  }

  return lead
}
