import { prisma } from '@/lib/prisma';

/** Every person with access to the workspace: the owner plus every `WorkspaceMember`. */
export async function workspaceMemberIds(workspaceId: string): Promise<string[]> {
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { ownerId: true, members: { select: { userId: true } } },
  });
  if (!workspace) return [];
  return Array.from(new Set([workspace.ownerId, ...workspace.members.map((m) => m.userId)]));
}

/** The owner plus members whose role is 'owner' or 'admin'. Used to CC the people who run the workspace. */
export async function workspaceAdminIds(workspaceId: string): Promise<string[]> {
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: {
      ownerId: true,
      members: { where: { role: { in: ['owner', 'admin'] } }, select: { userId: true } },
    },
  });
  if (!workspace) return [];
  return Array.from(new Set([workspace.ownerId, ...workspace.members.map((m) => m.userId)]));
}

/** Members with a resolvable name, for @mention matching. */
export async function workspaceMembersForMentions(
  workspaceId: string
): Promise<{ id: string; name: string | null }[]> {
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: {
      owner: { select: { id: true, name: true } },
      members: { select: { user: { select: { id: true, name: true } } } },
    },
  });
  if (!workspace) return [];
  const byId = new Map<string, { id: string; name: string | null }>();
  byId.set(workspace.owner.id, workspace.owner);
  for (const m of workspace.members) byId.set(m.user.id, m.user);
  return Array.from(byId.values());
}
