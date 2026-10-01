import { prisma } from '@/lib/prisma';
import { sendTransactionalEmail } from '@/lib/email';
import { absoluteUrl } from '@/lib/url';
import { resolvePrefs } from './prefs';
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
      await Promise.allSettled(
        emailTargets.map((user) =>
          sendTransactionalEmail({
            to: user.email,
            subject: input.title,
            html: renderNotificationEmail({ name: user.name, title: input.title, body: input.body, href: input.href }),
          })
        )
      );
    }
  } catch (error) {
    console.error('[notifications] notify() failed:', error);
  }
}

function renderNotificationEmail({
  name,
  title,
  body,
  href,
}: {
  name: string | null;
  title: string;
  body?: string;
  href?: string;
}): string {
  const greeting = name ? `Hi ${escapeHtml(name.split(' ')[0])},` : 'Hi,';
  const cta = href
    ? `<p style="margin-top:24px"><a href="${escapeHtml(absoluteUrl(href))}" style="display:inline-block;background:#111827;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:600">View in BorsFlow</a></p>`
    : '';
  return `
    <div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#111827;max-width:480px">
      <p>${greeting}</p>
      <p style="font-size:16px;font-weight:600;margin-bottom:4px">${escapeHtml(title)}</p>
      ${body ? `<p style="color:#4b5563;margin-top:4px">${escapeHtml(body)}</p>` : ''}
      ${cta}
      <p style="margin-top:32px;font-size:12px;color:#9ca3af">
        You're receiving this because of your notification settings in BorsFlow.
        <a href="${escapeHtml(absoluteUrl('/settings?section=notifications'))}" style="color:#9ca3af">Manage preferences</a>.
      </p>
    </div>
  `;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
