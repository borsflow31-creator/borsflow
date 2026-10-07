import { prisma } from '@/lib/prisma'
import { isWorkspaceMember } from '@/lib/crm/access'
import { parseStages } from '@/lib/crm/lifecycle'
import { scoreLead } from '@/lib/crm/lead-score'
import { assignOwnerForNewLead } from './developer/lead-assignment'
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
  // Developer CRM. Left out, the owner is assigned automatically in a
  // developer's workspace; null leaves the lead unassigned on purpose.
  ownerId?: string | null
  campaign?: string | null
  interestedProgramId?: string | null
  interestedTypology?: string | null
  budgetMin?: unknown
  budgetMax?: unknown
  preferredLocation?: string | null
}

export interface DeveloperLeadFields {
  ownerId?: string | null
  campaign?: string | null
  interestedProgramId?: string | null
  interestedTypology?: string | null
  budgetMin?: number | null
  budgetMax?: number | null
  preferredLocation?: string | null
}

function readText(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null
  return value.trim().slice(0, max) || null
}

function readMoney(value: unknown, label: string): number | null {
  if (value === null || value === '') return null
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n) || n < 0) throw new ServiceError(`${label} must be zero or more`)
  return n
}

/**
 * Reads and checks the developer-only lead fields from a request body.
 *
 * For each field, absent means "leave as it is", and null or an empty string
 * means "clear it", so the same function serves create and update. The owner must
 * be a member of the workspace and the project one of its own, because ids come
 * from the client and either would otherwise let a lead point into another
 * workspace. `existing` is the lead's current budget, so changing only one end of
 * the range is still checked against the other.
 */
export async function readDeveloperLeadFields(
  workspaceId: string,
  input: Record<string, unknown>,
  existing?: { budgetMin: number | null; budgetMax: number | null }
): Promise<DeveloperLeadFields> {
  const out: DeveloperLeadFields = {}
  const has = (key: string) => input[key] !== undefined

  if (has('ownerId')) {
    const ownerId = readText(input.ownerId, 100)
    if (ownerId && !(await isWorkspaceMember(workspaceId, ownerId))) {
      throw new ServiceError('Owner must be a member of this workspace')
    }
    out.ownerId = ownerId
  }

  if (has('interestedProgramId')) {
    const programId = readText(input.interestedProgramId, 100)
    if (programId) {
      const program = await prisma.program.findFirst({
        where: { id: programId, workspaceId },
        select: { id: true },
      })
      if (!program) throw new ServiceError('Project not found in this workspace')
    }
    out.interestedProgramId = programId
  }

  if (has('campaign')) out.campaign = readText(input.campaign, 120)
  if (has('interestedTypology')) out.interestedTypology = readText(input.interestedTypology, 40)
  if (has('preferredLocation')) out.preferredLocation = readText(input.preferredLocation, 200)
  if (has('budgetMin')) out.budgetMin = readMoney(input.budgetMin, 'Minimum budget')
  if (has('budgetMax')) out.budgetMax = readMoney(input.budgetMax, 'Maximum budget')

  const min = out.budgetMin !== undefined ? out.budgetMin : existing?.budgetMin ?? null
  const max = out.budgetMax !== undefined ? out.budgetMax : existing?.budgetMax ?? null
  if (min !== null && max !== null && min > max) {
    throw new ServiceError('Minimum budget cannot be more than the maximum')
  }

  return out
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

  const developer = await readDeveloperLeadFields(pipeline.workspaceId, input as unknown as Record<string, unknown>)
  // No owner given: a developer's workspace hands the lead to whoever is carrying
  // the fewest. An explicit null is respected as "unassigned".
  const ownerId =
    developer.ownerId !== undefined ? developer.ownerId : await assignOwnerForNewLead(pipeline.workspaceId)

  const leadStage = stage || firstStage
  const { score } = scoreLead({
    email,
    phone,
    budgetMin: developer.budgetMin,
    budgetMax: developer.budgetMax,
    interestedProgramId: developer.interestedProgramId,
    interestedTypology: developer.interestedTypology,
    source,
    stage: leadStage,
    stages: parseStages(pipeline.stages),
  })

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
      stage: leadStage,
      value: parsedValue,
      source,
      ownerId,
      campaign: developer.campaign,
      interestedProgramId: developer.interestedProgramId,
      interestedTypology: developer.interestedTypology,
      budgetMin: developer.budgetMin,
      budgetMax: developer.budgetMax,
      preferredLocation: developer.preferredLocation,
      score,
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
