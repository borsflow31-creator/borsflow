import { prisma } from '@/lib/prisma';
import { sendTransactionalEmail } from '@/lib/email';
import { resolvePrefs } from './prefs';
import { renderNotificationEmail, type NotificationTime } from './email';
import { TYPE_CATEGORY, isEmailableType, type NotificationType } from './types';

export interface NotifyInput {
  /** User ids to notify. The actor (if included) and duplicates are dropped automatically. */
  recipients: string[];
  type: NotificationType;
  workspaceId?: string;
  /** Who caused the event, so they never get notified about their own action. */
  actorId?: string;
  title: string;
  body?: string;
  /** In-app path the notification opens when clicked, e.g. `/quotes/abc123`. */
  href?: string;
  /**
   * When the event is about a moment in time (a meeting starting, a card due),
   * pass it here rather than formatting it into `body`: the email then states it
   * with its time zone named, which a bare `toLocaleString()` does not.
   */
  when?: NotificationTime;
  /**
   * Shared across every recipient of one event (e.g. `invoice.overdue:<id>`).
   * Combined with the recipient's own id, this is what keeps a cron re-run or a
   * webhook replay from creating a second notification for the same person.
   * Leave unset for events that are naturally one-shot (e.g. a direct user action).
   */
  dedupeKey?: string;
}

/**
 * Create in-app notifications and send emails for the recipients who want
 * them, honoring each person's per-category preference and the master email
 * switch. Never throws — a notification failing to send must never fail the
 * request that triggered it.
 */
export async function notify(input: NotifyInput): Promise<void> {
  try {
    const recipientIds = Array.from(new Set(input.recipients)).filter(
      (id) => id && id !== input.actorId
    );
    if (recipientIds.length === 0) return;

    const category = TYPE_CATEGORY[input.type];
    const canEmail = isEmailableType(input.type);

    const users = await prisma.user.findMany({
      where: { id: { in: recipientIds } },
      select: { id: true, email: true, name: true, notificationsEmail: true, notificationPrefs: true },
    });

    const rows: {
      userId: string;
      workspaceId: string | null;
      actorId: string | null;
      type: string;
      category: string;
      title: string;
      body: string | null;
      href: string | null;
      dedupeKey: string | null;
      emailedAt: Date | null;
    }[] = [];
    const emailTargets: { id: string; email: string; name: string | null }[] = [];

    for (const user of users) {
      const prefs = resolvePrefs(user.notificationPrefs)[category];
      const willEmail = canEmail && prefs.email && user.notificationsEmail;

      if (!prefs.inApp && !willEmail) continue;

      rows.push({
        userId: user.id,
        workspaceId: input.workspaceId ?? null,
        actorId: input.actorId ?? null,
        type: input.type,
        category,
        title: input.title,
        body: input.body ?? null,
        href: input.href ?? null,
        dedupeKey: input.dedupeKey ?? null,
        emailedAt: willEmail ? new Date() : null,
      });

      if (willEmail) emailTargets.push({ id: user.id, email: user.email, name: user.name });
    }

    if (rows.length > 0) {
      await prisma.notification.createMany({ data: rows, skipDuplicates: true });
    }

    if (emailTargets.length > 0) {
      // Only now, and only once for the whole event: the workspace name is for
      // the email's "In <workspace>" line, so there is nothing to look up when
      // every recipient has email notifications off.
      const workspaceName = input.workspaceId
        ? (
            await prisma.workspace.findUnique({
              where: { id: input.workspaceId },
              select: { name: true },
            })
          )?.name ?? null
        : null;

      await Promise.allSettled(
        emailTargets.map((user) => {
          const { html, text } = renderNotificationEmail({
            type: input.type,
            recipient: { name: user.name, email: user.email },
            workspaceName,
            title: input.title,
            body: input.body,
            when: input.when,
            href: input.href,
          });
          return sendTransactionalEmail({ to: user.email, subject: input.title, html, text });
        })
      );
    }
  } catch (error) {
    console.error('[notifications] notify() failed:', error);
  }
}
