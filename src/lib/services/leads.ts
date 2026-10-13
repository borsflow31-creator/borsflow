import { prisma } from '@/lib/prisma'
import { isWorkspaceMember } from '@/lib/crm/access'
import { parseStages } from '@/lib/crm/lifecycle'
import { scoreLead } from '@/lib/crm/lead-score'
import { leadStatusForStage } from '@/lib/crm/lead-status'
import { checkLotSelection, MAX_INTERESTED_LOTS, readLotIds } from '@/lib/crm/contact-match'
import { CrmLogger } from '@/lib/crm/logger'
import { assignOwnerForNewLead } from './developer/lead-assignment'
import { syncLeadFollowUp } from './developer/lead-sync'
import { readNewTaskFields, type TaskInput } from './developer/tasks'
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
  /** Units of the programme the buyer asked about (developer CRM). */
  interestedLotIds?: unknown
  /** A follow-up to create with the lead, in the same transaction. */
  firstTask?: TaskInput | null
  /** Set by the form, once per form; a retry with the same key returns the same lead. */
  clientRequestId?: string | null
  /** Who is creating it: recorded on the lead and on what is created with it. */
  createdById?: string | null
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

const LOT_SELECTION_ERRORS = {
  not_found: 'Unit not found in this workspace',
  not_available: 'That unit is no longer available',
  wrong_program: 'Every unit must belong to the chosen project',
  mixed_programs: 'Units must all belong to one project',
} as const

/**
 * Reads `interestedLotIds` from a request body and checks each unit against the
 * database: in this workspace, still available, and in the lead's project. The
 * client sends ids only; nothing about a unit (its price least of all) is taken
 * from it. Absent means "leave the interests alone".
 *
 * `programId` is the project the lead will have after this save. Returns the
 * project the units imply, so a lead given units but no project gets one.
 * `keepIds` are units already on the lead, allowed even if since sold.
 */
export async function readLotInterests(
  workspaceId: string,
  input: Record<string, unknown>,
  programId: string | null,
  keepIds: readonly string[] = []
): Promise<{ lotIds?: string[]; programId: string | null }> {
  const lotIds = readLotIds(input.interestedLotIds)
  if (lotIds === undefined) return { programId }
  if (lotIds.length > MAX_INTERESTED_LOTS) {
    throw new ServiceError(`At most ${MAX_INTERESTED_LOTS} units per lead`)
  }
  const found = lotIds.length
    ? await prisma.developmentLot.findMany({
        where: { id: { in: lotIds }, workspaceId },
        select: { id: true, programId: true, status: true },
      })
    : []
  const result = checkLotSelection(lotIds, found, programId, keepIds)
  if (!result.ok) throw new ServiceError(LOT_SELECTION_ERRORS[result.error])
  return { lotIds, programId: result.programId }
}

/**
 * The lead a form already created with this request key, if any. A retried
 * submit (double click, a dropped response) gets that lead back instead of
 * making a second one. A key from another workspace is refused rather than
 * answered, so it cannot be used to read someone else's lead.
 */
export async function findLeadByRequestId(workspaceId: string, clientRequestId: unknown) {
  const key = readText(clientRequestId, 100)
  if (!key) return null
  const lead = await prisma.lead.findUnique({
    where: { clientRequestId: key },
    include: { pipeline: { select: { workspaceId: true } } },
  })
  if (!lead) return null
  if (lead.pipeline.workspaceId !== workspaceId) throw new ServiceError('Invalid request key', 409)
  const { pipeline: _pipeline, ...rest } = lead
  void _pipeline
  return rest
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

  const body = input as unknown as Record<string, unknown>
  const developer = await readDeveloperLeadFields(pipeline.workspaceId, body)
  // Units are checked against the project chosen; with none chosen, they set it.
  const lots = await readLotInterests(pipeline.workspaceId, body, developer.interestedProgramId ?? null)
  if (lots.lotIds?.length) developer.interestedProgramId = lots.programId
  const firstTask = input.firstTask ? readNewTaskFields(input.firstTask) : null
  // No owner given: a developer's workspace hands the lead to whoever is carrying
  // the fewest. An explicit null is respected as "unassigned".
  const ownerId =
    developer.ownerId !== undefined ? developer.ownerId : await assignOwnerForNewLead(pipeline.workspaceId)

  // The follow-up goes to who it was given to, else the lead's owner, else whoever
  // is creating it: an unassigned task is one nobody sees on their list.
  const taskAssigneeId = firstTask
    ? firstTask.assigneeId !== undefined ? firstTask.assigneeId : ownerId ?? input.createdById ?? null
    : null
  if (taskAssigneeId && taskAssigneeId !== ownerId && !(await isWorkspaceMember(pipeline.workspaceId, taskAssigneeId))) {
    throw new ServiceError('Assignee must be a member of this workspace')
  }

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

  const clientRequestId = readText(input.clientRequestId, 100)
  const createdById = input.createdById ?? null

  // The lead and what comes with it land together or not at all, so a failure
  // never leaves a lead without the follow-up the form showed as scheduled.
  let created
  try {
    created = await prisma.$transaction(async (tx) => {
      const lead = await tx.lead.create({
        data: {
          firstName,
          lastName,
          email,
          phone,
          company,
          position,
          status: leadStatusForStage(leadStage) ?? (status || 'new'),
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
          clientRequestId,
          ...(createdById && { createdById }),
        },
      })

      if (listIds.length > 0) {
        await tx.leadListLead.createMany({
          data: listIds.map((leadListId) => ({ leadId: lead.id, leadListId })),
        })
      }

      if (lots.lotIds?.length) {
        await tx.leadLotInterest.createMany({
          data: lots.lotIds.map((lotId) => ({
            workspaceId: pipeline.workspaceId,
            leadId: lead.id,
            lotId,
            createdById,
          })),
        })
      }

      const task = firstTask
        ? await tx.leadTask.create({
            data: {
              workspaceId: pipeline.workspaceId,
              leadId: lead.id,
              type: firstTask.type,
              title: firstTask.title,
              notes: firstTask.notes,
              dueAt: firstTask.dueAt,
              assigneeId: taskAssigneeId,
              createdById,
            },
          })
        : null

      return { lead, task }
    })
  } catch (error) {
    // Two submits raced past the replay check: the loser returns the winner's lead.
    if (clientRequestId && (error as { code?: string }).code === 'P2002') {
      const existing = await findLeadByRequestId(pipeline.workspaceId, clientRequestId)
      if (existing) return existing
    }
    throw error
  }

  const { lead, task } = created
  if (task) {
    await syncLeadFollowUp(lead.id)
    if (createdById) {
      const buyer = `${lead.firstName} ${lead.lastName}`.trim()
      await CrmLogger.logActivity(
        pipeline.workspaceId,
        createdById,
        'task_created',
        lead.id,
        `Follow-up added for ${buyer}: ${task.title}`,
        { taskId: task.id, type: task.type, dueAt: task.dueAt.toISOString(), buyer, title: task.title },
        lead.id
      )
    }
  }

  return lead
}
