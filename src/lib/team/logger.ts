import { prisma } from '../prisma';

/**
 * Who joined, left, was invited or changed role, and who signed in: the team side
 * of a workspace's history, next to the CRM events CrmLogger writes.
 *
 * Same table and conventions as CrmLogger (src/lib/crm/logger.ts): one Activity
 * row per event, `userId` is who did it, and writes are best-effort so a failed
 * audit row never fails the action itself.
 */
export type TeamActivityType =
  | 'member_invited'
  | 'invitation_revoked'
  | 'member_joined'
  | 'member_role_changed'
  | 'member_removed'
  | 'member_left'
  | 'user_signed_in';

interface TeamActivityInput {
  workspaceId: string;
  /** Who did it. */
  userId: string;
  type: TeamActivityType;
  /** The person (user id) or invitation the event is about. */
  entityId: string;
  description: string;
  metadata?: Record<string, unknown>;
}

export class TeamLogger {
  static async log(input: TeamActivityInput) {
    try {
      return await prisma.activity.create({
        data: {
          workspaceId: input.workspaceId,
          userId: input.userId,
          type: input.type,
          entityType: 'member',
          entityId: input.entityId,
          description: input.description,
          metadata: input.metadata ? JSON.stringify(input.metadata) : undefined,
        },
      });
    } catch (e) {
      console.error('Failed to write team activity log to DB:', e);
    }
  }

  /**
   * One row in every workspace the person owns or belongs to, so each team's log
   * shows when its people were last in. Never throws.
   */
  static async logSignIn(userId: string, method: string) {
    try {
      const [owned, memberships] = await Promise.all([
        prisma.workspace.findMany({ where: { ownerId: userId }, select: { id: true } }),
        prisma.workspaceMember.findMany({ where: { userId }, select: { workspaceId: true } }),
      ]);
      const ids = new Set([...owned.map((w) => w.id), ...memberships.map((m) => m.workspaceId)]);
      if (ids.size === 0) return;
      await prisma.activity.createMany({
        data: [...ids].map((workspaceId) => ({
          workspaceId,
          userId,
          type: 'user_signed_in',
          entityType: 'member',
          entityId: userId,
          description: 'Signed in',
          metadata: JSON.stringify({ method }),
        })),
      });
    } catch (e) {
      console.error('Failed to write sign-in activity log to DB:', e);
    }
  }
}
