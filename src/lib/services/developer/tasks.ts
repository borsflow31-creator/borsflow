import { prisma } from '@/lib/prisma'
import { isWorkspaceMember } from '@/lib/crm/access'
import { CrmLogger } from '@/lib/crm/logger'
import { isLeadTaskType, type LeadTaskType } from '@/lib/crm/lifecycle'
import { ServiceError } from '../errors'
import { readString } from '../parse'
import type { DeveloperContext } from './programs'
import { syncLeadFollowUp, touchLead } from './lead-sync'

/** Completing one of these means someone actually spoke to the lead. */
const CONTACT_TASK_TYPES: readonly LeadTaskType[] = ['call', 'follow_up']

export interface TaskInput {
  leadId?: string
  type?: string
  title?: string
  notes?: string | null
  dueAt?: string | Date
  assigneeId?: string | null
}

function readDue(value: unknown): Date {
  const date = value instanceof Date ? value : new Date(String(value))
  if (value === undefined || value === null || value === '' || Number.isNaN(date.getTime())) {
    throw new ServiceError('A due date is required')
  }
  return date
}

const taskInclude = {
  lead: { select: { id: true, firstName: true, lastName: true, phone: true, email: true } },
  assignee: { select: { id: true, name: true, email: true } },
} as const

export interface TaskFilters {
  /** 'mine' is the caller's own; 'all' is everyone's, for a manager's view. */
  scope?: 'mine' | 'all'
  status?: 'open' | 'done' | 'overdue' | 'all'
  leadId?: string
  assigneeId?: string
  limit?: number
}

export async function listTasks(ctx: DeveloperContext, filters: TaskFilters = {}) {
  const where: any = { workspaceId: ctx.workspaceId }
  if (filters.leadId) where.leadId = filters.leadId
  if (filters.assigneeId) where.assigneeId = filters.assigneeId
  else if ((filters.scope ?? 'mine') === 'mine' && !filters.leadId) where.assigneeId = ctx.userId

  const status = filters.status ?? 'open'
  if (status === 'open') where.completedAt = null
  else if (status === 'done') where.completedAt = { not: null }
  else if (status === 'overdue') {
    where.completedAt = null
    where.dueAt = { lt: new Date() }
  }

  return prisma.leadTask.findMany({
    where,
    include: taskInclude,
    // Open work is read soonest-first; finished work, most recent first.
    orderBy: status === 'done' ? { completedAt: 'desc' } : { dueAt: 'asc' },
    take: Math.min(Math.max(filters.limit ?? 200, 1), 500),
  })
}

export async function createTask(ctx: DeveloperContext, input: TaskInput) {
  const body = input as Record<string, unknown>
  const leadId = readString(body, 'leadId', 'Lead', { required: true })!
  const title = readString(body, 'title', 'Title', { required: true, max: 200 })!
  const notes = readString(body, 'notes', 'Notes', { max: 2000 }) ?? null
  const dueAt = readDue(input.dueAt)

  const type = input.type ?? 'follow_up'
  if (!isLeadTaskType(type)) throw new ServiceError('Unknown task type')

  const lead = await prisma.lead.findFirst({
    where: { id: leadId, pipeline: { workspaceId: ctx.workspaceId } },
    select: { id: true, firstName: true, lastName: true, ownerId: true },
  })
  if (!lead) throw new ServiceError('Lead not found in this workspace', 404)

  // Unassigned tasks are tasks nobody sees on their list. Default to the lead's
  // owner, then to whoever is creating it.
  const assigneeId =
    input.assigneeId === undefined ? lead.ownerId ?? ctx.userId : input.assigneeId || null
  if (assigneeId && !(await isWorkspaceMember(ctx.workspaceId, assigneeId))) {
    throw new ServiceError('Assignee must be a member of this workspace')
  }

  const task = await prisma.leadTask.create({
    data: {
      workspaceId: ctx.workspaceId,
      leadId,
      type,
      title,
      notes,
      dueAt,
      assigneeId,
      createdById: ctx.userId,
    },
    include: taskInclude,
  })

  await syncLeadFollowUp(leadId)
  await CrmLogger.logActivity(
    ctx.workspaceId,
    ctx.userId,
    'task_created',
    leadId,
    `Follow-up added for ${`${lead.firstName} ${lead.lastName}`.trim()}: ${title}`,
    { taskId: task.id, type, dueAt: dueAt.toISOString() },
    leadId
  )
  return task
}

async function loadTask(ctx: DeveloperContext, id: string) {
  const task = await prisma.leadTask.findFirst({
    where: { id, workspaceId: ctx.workspaceId },
    include: { lead: { select: { firstName: true, lastName: true } } },
  })
  if (!task) throw new ServiceError('Task not found', 404)
  return task
}

export async function updateTask(ctx: DeveloperContext, id: string, input: TaskInput) {
  const existing = await loadTask(ctx, id)
  const body = input as Record<string, unknown>
  const data: any = {}

  const title = readString(body, 'title', 'Title', { required: false, max: 200 })
  if (title !== undefined) {
    if (title === null) throw new ServiceError('Title is required')
    data.title = title
  }
  const notes = readString(body, 'notes', 'Notes', { max: 2000 })
  if (notes !== undefined) data.notes = notes
  if (input.dueAt !== undefined) data.dueAt = readDue(input.dueAt)
  if (input.type !== undefined) {
    if (!isLeadTaskType(input.type)) throw new ServiceError('Unknown task type')
    data.type = input.type
  }
  if (input.assigneeId !== undefined) {
    const assigneeId = input.assigneeId || null
    if (assigneeId && !(await isWorkspaceMember(ctx.workspaceId, assigneeId))) {
      throw new ServiceError('Assignee must be a member of this workspace')
    }
    data.assigneeId = assigneeId
  }

  const task = await prisma.leadTask.update({ where: { id }, data, include: taskInclude })
  await syncLeadFollowUp(existing.leadId)
  return task
}

/**
 * Marks a task done. A call or follow-up counts as contact with the lead, which
 * is what clears them out of "not contacted recently" and lifts their score.
 */
export async function completeTask(ctx: DeveloperContext, id: string) {
  const existing = await loadTask(ctx, id)
  if (existing.completedAt) return loadTaskWithRelations(id)

  const now = new Date()
  await prisma.leadTask.update({ where: { id }, data: { completedAt: now } })
  await syncLeadFollowUp(existing.leadId)
  if (CONTACT_TASK_TYPES.includes(existing.type as LeadTaskType)) await touchLead(existing.leadId, now)

  await CrmLogger.logActivity(
    ctx.workspaceId,
    ctx.userId,
    'task_completed',
    existing.leadId,
    `Follow-up done for ${`${existing.lead.firstName} ${existing.lead.lastName}`.trim()}: ${existing.title}`,
    { taskId: id, type: existing.type },
    existing.leadId
  )
  return loadTaskWithRelations(id)
}

export async function reopenTask(ctx: DeveloperContext, id: string) {
  const existing = await loadTask(ctx, id)
  await prisma.leadTask.update({ where: { id }, data: { completedAt: null } })
  await syncLeadFollowUp(existing.leadId)
  return loadTaskWithRelations(id)
}

export async function deleteTask(ctx: DeveloperContext, id: string) {
  const existing = await loadTask(ctx, id)
  await prisma.leadTask.delete({ where: { id } })
  await syncLeadFollowUp(existing.leadId)
  return { success: true }
}

function loadTaskWithRelations(id: string) {
  return prisma.leadTask.findUniqueOrThrow({ where: { id }, include: taskInclude })
}
