/**
 * Notification category and type registry.
 *
 * A "type" is a specific event (`quote.accepted`); a "category" is what Settings
 * lets people turn on or off (`sales`). Every type belongs to exactly one category.
 */

export const NOTIFICATION_CATEGORIES = ['team', 'sales', 'meetings', 'tasks'] as const;
export type NotificationCategory = (typeof NOTIFICATION_CATEGORIES)[number];

export const NOTIFICATION_TYPES = [
  // team
  'team.invitation_accepted',
  'team.mentioned_comment',
  'team.mentioned_chat',
  'team.comment_reply',
  // sales
  'sales.quote_viewed',
  'sales.quote_accepted',
  'sales.quote_rejected',
  'sales.quote_expired',
  'sales.invoice_viewed',
  'sales.invoice_paid',
  'sales.invoice_overdue',
  // meetings
  'meetings.booked',
  'meetings.rescheduled',
  'meetings.cancelled',
  'meetings.reminder',
  // tasks
  'tasks.card_assigned',
  'tasks.card_due_soon',
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export const TYPE_CATEGORY: Record<NotificationType, NotificationCategory> = {
  'team.invitation_accepted': 'team',
  'team.mentioned_comment': 'team',
  'team.mentioned_chat': 'team',
  'team.comment_reply': 'team',
  'sales.quote_viewed': 'sales',
  'sales.quote_accepted': 'sales',
  'sales.quote_rejected': 'sales',
  'sales.quote_expired': 'sales',
  'sales.invoice_viewed': 'sales',
  'sales.invoice_paid': 'sales',
  'sales.invoice_overdue': 'sales',
  'meetings.booked': 'meetings',
  'meetings.rescheduled': 'meetings',
  'meetings.cancelled': 'meetings',
  'meetings.reminder': 'meetings',
  'tasks.card_assigned': 'tasks',
  'tasks.card_due_soon': 'tasks',
};

/** Types that are purely informational and not worth an email even when the category allows one. */
const NO_EMAIL_TYPES: ReadonlySet<NotificationType> = new Set([
  'sales.quote_viewed',
  'sales.invoice_viewed',
  'team.mentioned_chat',
]);

export function isEmailableType(type: NotificationType): boolean {
  return !NO_EMAIL_TYPES.has(type);
}

export const CATEGORY_LABELS: Record<NotificationCategory, { label: string; description: string }> = {
  team: { label: 'Team', description: 'Invitations accepted, mentions and replies' },
  sales: { label: 'Sales & billing', description: 'Quotes viewed or decided, invoices paid or overdue' },
  meetings: { label: 'Meetings', description: 'Bookings, reschedules, cancellations and reminders' },
  tasks: { label: 'Tasks', description: 'Cards assigned to you, or due soon' },
};
