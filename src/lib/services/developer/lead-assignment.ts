import { prisma } from '@/lib/prisma'
import { DEVELOPER_STAGE_LOST, DEVELOPER_STAGE_WON } from '@/lib/crm/lifecycle'

export interface AssignmentCandidate {
  userId: string
  /** Leads they own that are still being worked (not won, not lost). */
  openLeads: number
  /** When they last received a lead, or null if never. */
  lastAssignedAt: Date | null
}

/**
 * Who should get the next lead: whoever is carrying the fewest open ones.
 *
 * Balancing on open leads rather than taking turns means someone who closes
 * their leads gets fed more, and someone sitting on a pile of stale ones stops
 * getting new ones -- which is what a sales manager wants from "automatic". It is
 * also stateless: there is no pointer to keep in step with members joining and
 * leaving.
 *
 * Ties go to whoever received a lead longest ago (never counts as longest), then
 * to the lowest user id so the result is deterministic. Returns null with no
 * candidates.
 */
export function pickLeastLoaded(candidates: readonly AssignmentCandidate[]): string | null {
  if (candidates.length === 0) return null
  const sorted = [...candidates].sort((a, b) => {
    if (a.openLeads !== b.openLeads) return a.openLeads - b.openLeads
    const at = a.lastAssignedAt?.getTime() ?? -Infinity
    const bt = b.lastAssignedAt?.getTime() ?? -Infinity
    if (at !== bt) return at - bt
    return a.userId < b.userId ? -1 : a.userId > b.userId ? 1 : 0
  })
  return sorted[0].userId
}

/**
 * Whether a workspace is a developer's. The workspace owner's business type
 * decides, because that is the account that chose it; members invited later
 * inherit the workspace's way of working rather than answering for themselves.
 */
export async function isDeveloperWorkspace(workspaceId: string): Promise<boolean> {
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { owner: { select: { businessType: true } } },
  })
  return workspace?.owner.businessType === 'DEVELOPER'
}

/**
 * The owner a new lead should get automatically, or null when the workspace is
 * not a developer's or has nobody who can take it. Viewers are read-only, so they
 * are never given leads.
 *
 * Two leads arriving in the same instant can both pick the same person, since
 * nothing locks between counting and creating. At the volumes a sales team
 * sees that evens out on the next lead, and a lock would serialise every
 * enquiry for no real gain.
 */
export async function assignOwnerForNewLead(workspaceId: string): Promise<string | null> {
  const candidates = await loadAssignmentCandidates(workspaceId)
  return candidates ? pickLeastLoaded(candidates) : null
}

/**
 * The people a developer's workspace can hand leads to, with their current load,
 * or null when the workspace is not a developer's. Exposed separately so a bulk
 * import can load this once and keep the counts up to date in memory as it goes,
 * instead of re-counting for every row.
 */
export async function loadAssignmentCandidates(workspaceId: string): Promise<AssignmentCandidate[] | null> {
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: {
      ownerId: true,
      owner: { select: { businessType: true } },
      members: { where: { role: { not: 'viewer' } }, select: { userId: true } },
    },
  })
  if (!workspace || workspace.owner.businessType !== 'DEVELOPER') return null

  const userIds = Array.from(new Set([workspace.ownerId, ...workspace.members.map((m) => m.userId)]))

  const counts = await prisma.lead.groupBy({
    by: ['ownerId'],
    where: {
      pipeline: { workspaceId },
      ownerId: { in: userIds },
      stage: { notIn: [DEVELOPER_STAGE_WON, DEVELOPER_STAGE_LOST] },
    },
    _count: { _all: true },
  })
  const received = await prisma.lead.groupBy({
    by: ['ownerId'],
    where: { pipeline: { workspaceId }, ownerId: { in: userIds } },
    _max: { createdAt: true },
  })

  const open = new Map(counts.map((c) => [c.ownerId, c._count._all]))
  const last = new Map(received.map((r) => [r.ownerId, r._max.createdAt]))

  return userIds.map((userId) => ({
    userId,
    openLeads: open.get(userId) ?? 0,
    lastAssignedAt: last.get(userId) ?? null,
  }))
}
