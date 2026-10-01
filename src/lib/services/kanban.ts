import { prisma } from '@/lib/prisma'
import { ServiceError } from './errors'
import { notify } from '@/lib/notifications/notify'

/** `assignees` is stored as a JSON-stringified array of user ids. */
function parseAssignees(value: unknown[] | string | null | undefined): string[] {
  if (Array.isArray(value)) return value.filter((v): v is string => typeof v === 'string')
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : []
    } catch {
      return []
    }
  }
  return []
}

export const CARD_STATUSES = ['todo', 'inprogress', 'done'] as const
export const CARD_PRIORITIES = ['low', 'medium', 'high'] as const

/**
 * Create a kanban card. The caller must already have checked that the user may
 * create content in `workspaceId`.
 */
export async function createKanbanCard(params: {
  workspaceId: string
  userId?: string
  title: string
  description?: string | null
  status?: string | null
  priority?: string | null
  tags?: unknown[] | null
  projectId?: string | null
  dueDate?: string | Date | null
  assignees?: unknown[] | null
}) {
  const { workspaceId, userId, title, description, priority, tags, projectId, dueDate, assignees } = params

  const cardStatus = params.status || 'todo'
  if (!(CARD_STATUSES as readonly string[]).includes(cardStatus)) {
    throw new ServiceError('Status must be one of: todo, inprogress, done')
  }

  // The project must belong to this workspace. Otherwise a card could be
  // attached to another workspace's project and inflate its card count.
  if (projectId) {
    const project = await prisma.kanbanProject.findFirst({
      where: { id: projectId, workspaceId },
      select: { id: true },
    })
    if (!project) {
      throw new ServiceError('Project not found in this workspace')
    }
  }

  // Get the highest order within this workspace/status/project column
  const highestOrder = await prisma.kanbanCard.findFirst({
    where: { workspaceId, status: cardStatus, ...(projectId ? { projectId } : {}) },
    orderBy: { order: 'desc' },
    select: { order: true },
  })

  const card = await prisma.kanbanCard.create({
    data: {
      title,
      description,
      status: cardStatus,
      priority: priority || 'medium',
      tags: tags ? JSON.stringify(tags) : null,
      workspaceId,
      projectId: projectId || null,
      dueDate: dueDate ? new Date(dueDate) : null,
      assignees: assignees ? JSON.stringify(assignees) : null,
      order: (highestOrder?.order ?? -1) + 1,
      ...(userId ? { createdById: userId } : {}),
    },
    include: {
      project: {
        select: { id: true, name: true, color: true },
      },
    },
  })

  const assigneeIds = parseAssignees(assignees as unknown[] | null)
  if (assigneeIds.length > 0) {
    void notify({
      recipients: assigneeIds,
      type: 'tasks.card_assigned',
      workspaceId,
      actorId: userId,
      title: `You were assigned to "${title}"`,
      href: `/kanban-board-view?workspace=${workspaceId}`,
    })
  }

  return card
}
