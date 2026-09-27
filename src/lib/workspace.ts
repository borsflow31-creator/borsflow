import { Prisma } from '@prisma/client'
import { prisma } from './prisma'
import crypto from 'crypto'

export type Role = 'owner' | 'admin' | 'member' | 'viewer'

export type Permission =
  | 'workspace:read'
  | 'workspace:write'
  | 'workspace:delete'
  | 'workspace:invite'
  | 'workspace:manage_members'
  | 'content:create'
  | 'content:read'
  | 'content:write'
  | 'content:delete'
  | 'content:write_own'
  | 'content:delete_own'

// Role permissions mapping
const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  owner: [
    'workspace:read',
    'workspace:write',
    'workspace:delete',
    'workspace:invite',
    'workspace:manage_members',
    'content:create',
    'content:read',
    'content:write',
    'content:delete',
    'content:write_own',
    'content:delete_own',
  ],
  admin: [
    'workspace:read',
    'workspace:write',
    'workspace:invite',
    'workspace:manage_members',
    'content:create',
    'content:read',
    'content:write',
    'content:delete',
    'content:write_own',
    'content:delete_own',
  ],
  member: [
    'workspace:read',
    'content:create',
    'content:read',
    'content:write_own',
    'content:delete_own',
  ],
  viewer: ['workspace:read', 'content:read'],
}

/**
 * Check if a role has a specific permission
 */
export function hasPermission(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission)
}

/**
 * Get workspace membership for a user
 */
export async function getWorkspaceMembership(
  workspaceId: string,
  userId: string
) {
  const membership = await prisma.workspaceMember.findFirst({
    where: {
      workspaceId,
      userId,
    },
  })

  if (!membership) {
    return null
  }

  return membership
}

/**
 * Check if user has permission for a workspace
 */
export async function checkWorkspacePermission(
  workspaceId: string,
  userId: string,
  permission: Permission
): Promise<boolean> {
  // Workspace owners have all permissions
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { ownerId: true },
  })

  if (workspace?.ownerId === userId) {
    return hasPermission('owner', permission)
  }

  const membership = await getWorkspaceMembership(workspaceId, userId)

  if (!membership) {
    return false
  }

  return hasPermission(membership.role as Role, permission)
}

/**
 * Check if user can modify content (based on ownership and role)
 */
export function canModifyContent(
  membership: { role: string; userId: string },
  contentOwnerId: string
): boolean {
  // Owner and Admin can modify any content
  if (['owner', 'admin'].includes(membership.role)) {
    return true
  }

  // Members can only modify their own content
  if (membership.role === 'member') {
    return membership.userId === contentOwnerId
  }

  // Viewers cannot modify content
  return false
}

/**
 * Generate a secure token for invitations
 */
export function generateSecureToken(): string {
  return crypto.randomBytes(32).toString('hex')
}

/**
 * Get invitation expiration date (default 7 days from now)
 */
export function getInvitationExpiration(days: number = 7): Date {
  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + days)
  return expiresAt
}

/**
 * Validate invitation token
 */
export function validateToken(token: string): boolean {
  // Token should be 64 characters (32 bytes * 2 for hex)
  return /^[a-f0-9]{64}$/.test(token)
}

/**
 * Check if invitation has expired
 */
export function isInvitationExpired(expiresAt: Date): boolean {
  return new Date() > expiresAt
}

/**
 * Check if a user is an owner or admin in a workspace
 */
export async function isWorkspaceAdmin(
  workspaceId: string,
  userId: string
): Promise<boolean> {
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { ownerId: true },
  })
  if (workspace?.ownerId === userId) return true

  const membership = await getWorkspaceMembership(workspaceId, userId)
  if (!membership) return false
  return ['owner', 'admin'].includes(membership.role)
}

/**
 * Get page-level access for a user.
 * Returns 'ADMIN' for workspace owners/admins (full access bypass),
 * 'VIEW', 'EDIT' based on PageAccess record, or 'NONE' if no access.
 */
export async function getUserPageAccess(
  pageId: string,
  userId: string,
  workspaceId: string
): Promise<'ADMIN' | 'EDIT' | 'VIEW' | 'NONE'> {
  const admin = await isWorkspaceAdmin(workspaceId, userId)
  if (admin) return 'ADMIN'

  const record = await prisma.pageAccess.findUnique({
    where: { pageId_userId: { pageId, userId } },
  })

  if (!record) return 'NONE'
  return record.level as 'EDIT' | 'VIEW'
}

/**
 * Get the list of page IDs a user can access in a workspace.
 * Returns null for owners/admins (meaning unrestricted access).
 * Returns an array of page IDs for members/viewers.
 */
export async function getAccessiblePageIds(
  workspaceId: string,
  userId: string
): Promise<string[] | null> {
  const admin = await isWorkspaceAdmin(workspaceId, userId)
  if (admin) return null

  const records = await prisma.pageAccess.findMany({
    where: {
      userId,
      level: { in: ['VIEW', 'EDIT'] },
      page: { workspaceId },
    },
    select: { pageId: true },
  })

  return records.map((r: { pageId: string }) => r.pageId)
}

/**
 * Build the `where` fragment restricting a page query to what `userId` may read.
 *
 * Same rule as `getAccessiblePageIds` — workspace owners and admins see every page
 * in the workspace, everyone else sees only pages they hold a PageAccess record
 * for — but expressed as a filter so it can be applied across several workspaces at
 * once. Omitting `workspaceId` scopes the query to every workspace the user belongs
 * to, which is what the dashboard's cross-workspace activity feed needs.
 *
 * Callers must always apply this; a page query without it is unscoped and will
 * return other tenants' pages.
 */
export async function buildPageAccessWhere(
  userId: string,
  workspaceId?: string | null
): Promise<Prisma.PageWhereInput> {
  const workspaces = await prisma.workspace.findMany({
    where: {
      ...(workspaceId ? { id: workspaceId } : {}),
      OR: [{ ownerId: userId }, { members: { some: { userId } } }],
    },
    select: {
      id: true,
      ownerId: true,
      members: { where: { userId }, select: { role: true } },
    },
  })

  const adminWorkspaceIds: string[] = []
  const restrictedWorkspaceIds: string[] = []

  for (const workspace of workspaces) {
    const role =
      workspace.ownerId === userId ? 'owner' : workspace.members[0]?.role
    if (role === 'owner' || role === 'admin') {
      adminWorkspaceIds.push(workspace.id)
    } else {
      restrictedWorkspaceIds.push(workspace.id)
    }
  }

  const clauses: Prisma.PageWhereInput[] = []

  if (adminWorkspaceIds.length > 0) {
    clauses.push({ workspaceId: { in: adminWorkspaceIds } })
  }

  if (restrictedWorkspaceIds.length > 0) {
    const records = await prisma.pageAccess.findMany({
      where: {
        userId,
        level: { in: ['VIEW', 'EDIT'] },
        page: { workspaceId: { in: restrictedWorkspaceIds } },
      },
      select: { pageId: true },
    })
    if (records.length > 0) {
      clauses.push({ id: { in: records.map((r: { pageId: string }) => r.pageId) } })
    }
  }

  // No accessible workspace and no granted page: match nothing rather than
  // falling through to an empty filter, which would match everything.
  if (clauses.length === 0) return { id: { in: [] } }

  return clauses.length === 1 ? clauses[0] : { OR: clauses }
}

/**
 * Get valid roles for invitations (cannot invite as owner)
 */
export function getValidInvitationRoles(): string[] {
  return ['admin', 'member', 'viewer']
}

/**
 * Validate role for invitation
 */
export function isValidInvitationRole(role: string): boolean {
  return getValidInvitationRoles().includes(role)
}
