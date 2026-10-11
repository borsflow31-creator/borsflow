/**
 * The email body for an activity notification.
 *
 * In-app, a notification is a line of text and a destination — the surrounding
 * UI supplies the context. In an inbox there is no surrounding UI, so the same
 * line arrives next to mail from everyone else the reader deals with and has to
 * carry its own: which workspace it happened in, when, what was said, and what
 * the reader is being asked to do about it. This module turns a `NotifyInput`
 * into that mail, in BorsFlow's shared frame and with a plain-text part.
 */

import { escapeHtml } from '@/lib/html';
import { EMAIL, emailParagraph, emailQuote, renderEmail } from '@/lib/email';
import { absoluteUrl } from '@/lib/url';
import type { Messages } from '@/i18n/messages/en';
import type { Locale, MessageKey } from '@/i18n/I18nProvider';
import type { ServerTranslate } from '@/i18n/server';
import { TYPE_CATEGORY, type NotificationType } from './types';
import { localizeNotificationBody, localizeNotificationTitle } from './titles';

/** Where the footer link sends someone who wants fewer of these. */
const PREFS_PATH = '/settings?section=notifications';

/**
 * What each event asks the reader to do. "View in BorsFlow" told them nothing:
 * the label names the thing they are about to open, so the button is readable
 * on its own in a preview pane.
 *
 * `action` is null where opening something is not the point — a cancelled
 * meeting is already gone, and a button to the empty calendar slot is noise.
 * Typing this as a full Record means a new notification type will not compile
 * until someone has decided what its email says.
 */
type ActionKey = keyof Messages['notificationEmailAction'];

const NOTIFICATION_EMAIL: Record<NotificationType, { action: ActionKey | null; note?: true }> = {
  'team.invitation_accepted': { action: 'openWorkspace' },
  'team.mentioned_comment': { action: 'readAndReply' },
  'team.mentioned_chat': { action: 'openChat' },
  'team.comment_reply': { action: 'readAndReply' },

  'sales.quote_viewed': { action: 'openQuote' },
  'sales.quote_accepted': { action: 'openQuote', note: true },
  'sales.quote_rejected': { action: 'openQuote' },
  'sales.quote_expired': { action: 'openQuote', note: true },
  'sales.invoice_viewed': { action: 'openInvoice' },
  'sales.invoice_paid': { action: 'openInvoice' },
  'sales.invoice_overdue': { action: 'openInvoice', note: true },

  'crm.offer_received': { action: 'openOffer', note: true },
  'crm.offer_accepted': { action: 'openOffer', note: true },
  'crm.offer_rejected': { action: 'openOffer' },
  'crm.mandate_expiring': { action: 'openMandate', note: true },
  'crm.viewing_feedback': { action: 'openProperty' },
  'crm.property_matched': { action: 'openMatches', note: true },
  'crm.document_accepted': { action: 'openBuyer', note: true },
  'crm.call_overdue': { action: 'openCollections', note: true },
  'alerts.lead_no_response': { action: 'openBuyer', note: true },
  'alerts.lead_no_followup': { action: 'openFollowUps', note: true },
  'alerts.reservation_created': { action: 'openInventory' },
  'alerts.contract_signed': { action: 'openInventory' },
  'alerts.project_behind_target': { action: 'openProjects', note: true },
  'alerts.low_inventory': { action: 'openInventory', note: true },
  'alerts.high_cancellations': { action: 'openReports', note: true },

  'meetings.booked': { action: 'openMeetings', note: true },
  'meetings.rescheduled': { action: 'openMeetings', note: true },
  'meetings.cancelled': { action: null, note: true },
  'meetings.reminder': { action: 'openMeetings' },

  'tasks.card_assigned': { action: 'openBoard' },
  'tasks.card_due_soon': { action: 'openBoard' },
  'tasks.followup_due': { action: 'openFollowUps' },
};

/**
 * A date a recipient can act on.
 *
 * `Date.toLocaleString()` on a server renders in whatever locale and zone the
 * host happens to have, with no zone label — so "10/5/2026, 2:00:00 PM" in a
 * reminder could be any of several hours, and the reader cannot tell which.
 * Naming the zone is what makes it unambiguous; meetings carry their own
 * (`Meeting.timezone`), and anything else is stated in UTC rather than silently
 * shown in the server's.
 */
export function formatNotificationTime({ at, timeZone }: NotificationTime, locale: Locale = 'en'): string {
  // Spelled out as components rather than dateStyle/timeStyle: ECMA-402 rejects
  // combining those with timeZoneName, and naming the zone is the whole point.
  const format = (zone: string) =>
    new Intl.DateTimeFormat(DATE_LOCALE[locale], {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: zone,
      timeZoneName: 'short',
    }).format(at);

  try {
    return format(timeZone || 'UTC');
  } catch {
    // An unrecognised zone — a Cal.com payload can carry anything — would
    // otherwise throw inside notify() and lose the notification entirely.
    return format('UTC');
  }
}

/** Regional variants that write dates the way readers of each language expect (24-hour, day first). */
const DATE_LOCALE: Record<Locale, string> = { en: 'en-GB', fr: 'fr-FR', es: 'es-ES', de: 'de-DE', ar: 'ar-DZ' };

/** The note under the button, keyed by the event (`meetings.booked` -> `meetings_booked`, `sales.quote_accepted` -> `quote_accepted`). */
function noteKey(type: NotificationType): MessageKey {
  const name = type.startsWith('meetings.') ? type.replace('.', '_') : type.split('.')[1];
  return `notificationEmailNote.${name}` as MessageKey;
}

export interface NotificationTime {
  at: Date;
  /** IANA zone the time is quoted in; UTC when the event has no zone of its own. */
  timeZone?: string;
}

/** How much of a comment or chat message to quote before trailing off. */
const EXCERPT_LIMIT = 280;

/**
 * Comment and chat bodies are free text of any length. Quote enough to tell the
 * reader whether it needs them now, and let the button carry them to the rest.
 */
function excerpt(body: string): string {
  const flat = body.replace(/\s+/g, ' ').trim();
  if (flat.length <= EXCERPT_LIMIT) return flat;
  // Break at a word so the excerpt does not end mid-word.
  const cut = flat.slice(0, EXCERPT_LIMIT);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > EXCERPT_LIMIT - 40 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

export interface NotificationEmailInput {
  type: NotificationType;
  /** The person being emailed; their name opens the mail, their address explains it. */
  recipient: { name: string | null; email: string };
  /** The workspace the event happened in, when it belongs to one. */
  workspaceName?: string | null;
  title: string;
  body?: string;
  when?: NotificationTime;
  /** In-app path, e.g. `/quotes/abc123`. */
  href?: string;
  /** The recipient's language, and its translator (see i18n/server). */
  locale?: Locale;
  t: ServerTranslate;
}

/**
 * Render one notification as `{ html, text }`.
 *
 * The title is the heading rather than a line of body copy: callers already
 * write it as a full statement ("Acme accepted quote Q-2026-004"), and it is
 * also the subject, so heading and subject matching is what makes the mail
 * recognisable once it is open.
 */
export function renderNotificationEmail(input: NotificationEmailInput): { html: string; text: string; subject: string } {
  const { t } = input;
  const locale = input.locale ?? 'en';
  const spec = NOTIFICATION_EMAIL[input.type];
  const action = spec.action ? t(`notificationEmailAction.${spec.action}` as MessageKey) : null;
  const note = spec.note ? t(noteKey(input.type)) : null;
  const categoryLabel = t(`notificationEmailCategory.${TYPE_CATEGORY[input.type]}` as MessageKey);
  const firstName = input.recipient.name?.trim().split(/\s+/)[0];
  const greeting = firstName ? t('notificationEmail.greeting', { name: firstName }) : t('notificationEmail.greetingNoName');
  const url = input.href ? absoluteUrl(input.href) : undefined;

  // The title and body were written in English when the event happened; the
  // system's own wording is translated, anything a person typed is kept.
  const title = localizeNotificationTitle(input.title, t);
  let body = input.body ? localizeNotificationBody(input.body, t) : '';
  // Reminders also spell the time into the body, in English. The context line
  // states it in the reader's language, so drop the English copy.
  if (body && input.when) {
    body = body.replace(formatNotificationTime(input.when), '').replace(/\s*·\s*$/, '').trim();
  }

  // Where and when, on one line, so the heading does not have to repeat it.
  const context: string[] = [];
  if (input.workspaceName) context.push(t('notificationEmail.inWorkspace', { workspace: input.workspaceName }));
  if (input.when) context.push(formatNotificationTime(input.when, locale));
  const contextLine = context.join(' · ');

  const quoted = body ? excerpt(body) : '';

  // The preheader is the grey line beside the subject in an inbox list. The
  // subject is already the title, so repeating it there wastes the one place
  // the reader looks before deciding to open anything: lead with what was said,
  // and fall back to the context the heading leaves out.
  const preheader = quoted || contextLine || categoryLabel;

  const bodyHtml =
    emailParagraph(escapeHtml(greeting)) +
    (contextLine
      ? `<p style="margin:0 0 12px;font-family:${EMAIL.text};font-size:14px;line-height:1.625;color:${EMAIL.muted};">${escapeHtml(
          contextLine
        )}</p>`
      : '') +
    (quoted ? emailQuote(escapeHtml(quoted)) : '');

  const footer = t('notificationEmail.footer', { email: input.recipient.email, category: categoryLabel });
  const manage = t('notificationEmail.manage');

  const html = renderEmail({
    title,
    preheader: escapeHtml(preheader),
    heading: escapeHtml(title),
    body: bodyHtml,
    action: action && url ? { label: escapeHtml(action), url: escapeHtml(url) } : undefined,
    note: note ? escapeHtml(note) : undefined,
    footer:
      `${escapeHtml(footer)} ` +
      `<a href="${escapeHtml(absoluteUrl(PREFS_PATH))}" style="color:${EMAIL.muted};">${escapeHtml(manage)}</a>.`,
    lang: locale,
  });

  // Blocks, not lines: each entry is separated by a blank line, which is what
  // keeps the quoted excerpt and the link readable in a text-only client.
  const blocks = [`${greeting}\n\n${title}`];
  if (contextLine) blocks.push(contextLine);
  if (quoted) blocks.push(`"${quoted}"`);
  if (action && url) blocks.push(`${action}: ${url}`);
  if (note) blocks.push(note);
  blocks.push(`—\n${footer}\n${manage}: ${absoluteUrl(PREFS_PATH)}`);
  const text = blocks.join('\n\n');

  return { html, text, subject: title };
}
