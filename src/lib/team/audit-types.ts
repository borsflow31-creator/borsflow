/**
 * The activity log's shapes and filter groups, shared by the server
 * (src/lib/services/team/audit-log.ts) and the Team page. Kept free of Prisma so
 * the page can import the values without bundling the database client.
 */

/** The event filters on the log; the server maps each to the Activity types it covers. */
export const ACTIVITY_GROUPS = ['prospects', 'properties', 'sales', 'payments', 'meetings', 'team', 'signins'] as const
export type ActivityGroup = (typeof ACTIVITY_GROUPS)[number]

export function isActivityGroup(value: unknown): value is ActivityGroup {
  return typeof value === 'string' && (ACTIVITY_GROUPS as readonly string[]).includes(value)
}

export interface AuditLogEntry {
  id: string
  type: string
  entityType: string
  entityId: string
  description: string
  metadata: Record<string, unknown> | null
  createdAt: string
  actor: { id: string; name: string; email: string }
  leadId: string | null
  propertyId: string | null
}

export interface AuditLogPage {
  entries: AuditLogEntry[]
  /** Pass back as `cursor` for the next page; null when this was the last. */
  nextCursor: string | null
}

export interface TeamMemberRow {
  /** WorkspaceMember id; null for the owner, who has no member row. */
  memberId: string | null
  userId: string
  name: string
  email: string
  role: string
  joinedAt: string
  lastSignInAt: string | null
}
