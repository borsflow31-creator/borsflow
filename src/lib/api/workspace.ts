import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { hasPermission, type Permission, type Role } from '@/lib/workspace';

export async function requireWorkspaceAccess(workspaceId: string) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return { error: 'Unauthorized', status: 401 as const };
  }

  const workspace = await prisma.workspace.findFirst({
    where: {
      id: workspaceId,
      OR: [
        { ownerId: session.user.id },
        { members: { some: { userId: session.user.id } } },
      ],
    },
    select: { id: true },
  });

  if (!workspace) {
    return { error: 'Access denied', status: 403 as const };
  }

  return { session, workspace };
}

/**
 * Loads a meeting and verifies the caller belongs to its workspace.
 * Use on every /meetings/[id] route so access is derived from the record, not the client.
 */
export async function requireMeetingAccess(meetingId: string) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return { error: 'Unauthorized', status: 401 as const };
  }

  const meeting = await prisma.meeting.findUnique({ where: { id: meetingId } });

  if (!meeting) {
    return { error: 'Meeting not found', status: 404 as const };
  }

  const workspace = await prisma.workspace.findFirst({
    where: {
      id: meeting.workspaceId,
      OR: [
        { ownerId: session.user.id },
        { members: { some: { userId: session.user.id } } },
      ],
    },
    select: { id: true },
  });

  if (!workspace) {
    return { error: 'Access denied', status: 403 as const };
  }

  return { session, meeting };
}

/** True when the lead exists and sits in a pipeline of the given workspace. */
export async function leadBelongsToWorkspace(leadId: string, workspaceId: string) {
  const lead = await prisma.lead.findFirst({
    where: { id: leadId, pipeline: { workspaceId } },
    select: { id: true },
  });
  return !!lead;
}

const KNOWN_ROLES: Role[] = ['owner', 'admin', 'member', 'viewer'];

/** Roles are stored as a free-text column, so anything unrecognised gets the least privilege. */
function normalizeRole(value: string | null | undefined): Role {
  return KNOWN_ROLES.includes(value as Role) ? (value as Role) : 'viewer';
}

/**
 * Like `requireWorkspaceAccess`, but also resolves the caller's role and checks it
 * against a permission. Membership alone is not enough for mutations: a `viewer`
 * belongs to the workspace yet must not be able to change its content.
 */
export async function requireWorkspacePermission(
  workspaceId: string,
  permission: Permission
) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return { error: 'Unauthorized', status: 401 as const };
  }

  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { id: true, ownerId: true },
  });

  if (!workspace) {
    return { error: 'Access denied', status: 403 as const };
  }

  let role: Role;

  if (workspace.ownerId === session.user.id) {
    role = 'owner';
  } else {
    const membership = await prisma.workspaceMember.findFirst({
      where: { workspaceId, userId: session.user.id },
      select: { role: true },
    });

    if (!membership) {
      return { error: 'Access denied', status: 403 as const };
    }

    role = normalizeRole(membership.role);
  }

  if (!hasPermission(role, permission)) {
    return {
      error: 'You do not have permission to make changes in this workspace',
      status: 403 as const,
    };
  }

  return { session, workspace: { id: workspace.id }, role };
}

/**
 * True when `userId` may create or change content in the workspace (owner, admin
 * or member; viewers are read-only). For routes that have already confirmed
 * membership their own way and only need the role check on top.
 */
export async function canEditContent(workspaceId: string, userId: string): Promise<boolean> {
  return hasPermission(await getWorkspaceRole(workspaceId, userId), 'content:create');
}

/** The 403 body every content mutation returns to a read-only member. */
export const READ_ONLY_ERROR = 'You have view-only access to this workspace';

/**
 * Resolves the caller's role without gating on it, so read endpoints can tell the
 * client which write affordances to render.
 */
export async function getWorkspaceRole(workspaceId: string, userId: string): Promise<Role> {
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { ownerId: true },
  });

  if (workspace?.ownerId === userId) return 'owner';

  const membership = await prisma.workspaceMember.findFirst({
    where: { workspaceId, userId },
    select: { role: true },
  });

  return normalizeRole(membership?.role);
}
