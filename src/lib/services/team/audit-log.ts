import { prisma } from '@/lib/prisma'
import type { Prisma } from '@prisma/client'
import type { ActivityGroup, AuditLogEntry, AuditLogPage, TeamMemberRow } from '@/lib/team/audit-types'

export { ACTIVITY_GROUPS, isActivityGroup } from '@/lib/team/audit-types'
export type { ActivityGroup, AuditLogEntry, AuditLogPage, TeamMemberRow } from '@/lib/team/audit-types'

/**
 * A workspace's whole history in one feed: every CRM event (CrmLogger), every
 * meeting event (SchedulingLogger) and every team event (TeamLogger), newest
 * first, so an admin can see what each salesperson did.
 *
 * It reads the Activity table as written. Nothing here infers events that were
 * not recorded.
 */

const GROUP_TYPES: Record<ActivityGroup, Prisma.StringFilter> = {
  prospects: { in: ['lead_created', 'lead_updated', 'lead_stage_changed', 'lead_deleted', 'lead_imported', 'file_added', 'file_deleted', 'note_added', 'call_logged', 'task_created', 'task_completed'] },
  properties: { in: ['property_created', 'property_updated', 'property_status_changed', 'property_stage_changed', 'mandate_created', 'mandate_status_changed', 'mandate_renewed', 'price_changed', 'viewing_booked', 'viewing_feedback', 'site_visit_booked', 'site_visit_completed'] },
  sales: { in: ['interest_created', 'interest_stage_changed', 'interest_status_changed', 'offer_made', 'offer_accepted', 'offer_rejected', 'offer_withdrawn', 'sales_document_sent', 'sales_document_accepted'] },
  payments: { startsWith: 'payment_' },
  meetings: { in: ['meeting_created', 'meeting_updated', 'meeting_cancelled', 'meeting_completed', 'attendee_added'] },
  team: { in: ['member_invited', 'invitation_revoked', 'member_joined', 'member_role_changed', 'member_removed', 'member_left'] },
  signins: { equals: 'user_signed_in' },
}

export interface AuditLogFilter {
  userId?: string
  group?: ActivityGroup
  from?: Date
  /** Exclusive. */
  to?: Date
  /** The id of the last row of the previous page. */
  cursor?: string
  limit?: number
}

const MAX_LIMIT = 200

export async function listWorkspaceActivity(workspaceId: string, filter: AuditLogFilter = {}): Promise<AuditLogPage> {
  const limit = Math.min(Math.max(filter.limit ?? 50, 1), MAX_LIMIT)

  const where: Prisma.ActivityWhereInput = { workspaceId }
  if (filter.userId) where.userId = filter.userId
  if (filter.group) where.type = GROUP_TYPES[filter.group]
  if (filter.from || filter.to) {
    where.createdAt = {
      ...(filter.from ? { gte: filter.from } : {}),
      ...(filter.to ? { lt: filter.to } : {}),
    }
  }

  // One extra row says whether there is a next page without a count query.
  const rows = await prisma.activity.findMany({
    where,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: limit + 1,
    ...(filter.cursor ? { cursor: { id: filter.cursor }, skip: 1 } : {}),
    select: {
      id: true,
      type: true,
      entityType: true,
      entityId: true,
      description: true,
      metadata: true,
      createdAt: true,
      leadId: true,
      propertyId: true,
      user: { select: { id: true, name: true, email: true } },
    },
  })

  const page = rows.slice(0, limit)
  return {
    entries: page.map((r) => ({
      id: r.id,
      type: r.type,
      entityType: r.entityType,
      entityId: r.entityId,
      description: r.description,
      metadata: parseMetadata(r.metadata),
      createdAt: r.createdAt.toISOString(),
      actor: { id: r.user.id, name: r.user.name || r.user.email, email: r.user.email },
      leadId: r.leadId ?? (r.entityType === 'lead' ? r.entityId : null),
      propertyId: r.propertyId ?? (r.entityType === 'property' ? r.entityId : null),
    })),
    nextCursor: rows.length > limit ? page[page.length - 1].id : null,
  }
}

function parseMetadata(raw: string | null): Record<string, unknown> | null {
  if (!raw) return null
  try {
    const value = JSON.parse(raw)
    return value && typeof value === 'object' && !Array.isArray(value) ? value : null
  } catch {
    return null
  }
}

/** The owner first, then admins, commercials and viewers, each alphabetically. */
export async function listWorkspaceMembers(workspaceId: string): Promise<TeamMemberRow[]> {
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: {
      createdAt: true,
      owner: { select: { id: true, name: true, email: true } },
      members: { select: { id: true, role: true, createdAt: true, user: { select: { id: true, name: true, email: true } } } },
    },
  })
  if (!workspace) return []

  const userIds = [workspace.owner.id, ...workspace.members.map((m) => m.user.id)]
  const lastSignIns = await prisma.activity.groupBy({
    by: ['userId'],
    where: { workspaceId, type: 'user_signed_in', userId: { in: userIds } },
    _max: { createdAt: true },
  })
  const lastSeen = new Map(lastSignIns.map((r) => [r.userId, r._max.createdAt?.toISOString() ?? null]))

  const rows: TeamMemberRow[] = [
    {
      memberId: null,
      userId: workspace.owner.id,
      name: workspace.owner.name || workspace.owner.email,
      email: workspace.owner.email,
      role: 'owner',
      joinedAt: workspace.createdAt.toISOString(),
      lastSignInAt: lastSeen.get(workspace.owner.id) ?? null,
    },
  ]
  for (const m of workspace.members) {
    // An owner who also has a member row is listed once, as the owner.
    if (m.user.id === workspace.owner.id) continue
    rows.push({
      memberId: m.id,
      userId: m.user.id,
      name: m.user.name || m.user.email,
      email: m.user.email,
      role: m.role,
      joinedAt: m.createdAt.toISOString(),
      lastSignInAt: lastSeen.get(m.user.id) ?? null,
    })
  }

  const rank: Record<string, number> = { owner: 0, admin: 1, member: 2, viewer: 3 }
  return rows.sort((a, b) => (rank[a.role] ?? 9) - (rank[b.role] ?? 9) || a.name.localeCompare(b.name))
}
