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
  // real estate. Filed under 'sales' so no new preference category is needed and
  // nobody's saved notification settings change meaning.
  'crm.offer_received',
  'crm.offer_accepted',
  'crm.offer_rejected',
  'crm.mandate_expiring',
  'crm.viewing_feedback',
  'crm.property_matched',
  // developer sales
  'crm.document_accepted',
  'crm.call_overdue',
  // automatic alerts (see lib/crm/alert-rules)
  'alerts.lead_no_response',
  'alerts.lead_no_followup',
  'alerts.reservation_created',
  'alerts.contract_signed',
  'alerts.project_behind_target',
  'alerts.low_inventory',
  'alerts.high_cancellations',
  // meetings
  'meetings.booked',
  'meetings.rescheduled',
  'meetings.cancelled',
  'meetings.reminder',
  // tasks
  'tasks.card_assigned',
  'tasks.card_due_soon',
  'tasks.followup_due',
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
  'crm.offer_received': 'sales',
  'crm.offer_accepted': 'sales',
  'crm.offer_rejected': 'sales',
  'crm.mandate_expiring': 'sales',
  'crm.viewing_feedback': 'sales',
  'crm.property_matched': 'sales',
  'crm.document_accepted': 'sales',
  'crm.call_overdue': 'sales',
  'alerts.lead_no_response': 'sales',
  'alerts.lead_no_followup': 'sales',
  'alerts.reservation_created': 'sales',
  'alerts.contract_signed': 'sales',
  'alerts.project_behind_target': 'sales',
  'alerts.low_inventory': 'sales',
  'alerts.high_cancellations': 'sales',
  'meetings.booked': 'meetings',
  'meetings.rescheduled': 'meetings',
  'meetings.cancelled': 'meetings',
  'meetings.reminder': 'meetings',
  'tasks.card_assigned': 'tasks',
  'tasks.card_due_soon': 'tasks',
  'tasks.followup_due': 'tasks',
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
  sales: { label: 'Sales & billing', description: 'Quotes, invoices, offers, mandates and new-listing matches' },
  meetings: { label: 'Meetings', description: 'Bookings, reschedules, cancellations and reminders' },
  tasks: { label: 'Tasks', description: 'Cards assigned to you, or due soon' },
};
