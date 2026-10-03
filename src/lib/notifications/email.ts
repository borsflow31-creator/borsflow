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
import { CATEGORY_LABELS, TYPE_CATEGORY, type NotificationType } from './types';

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
const NOTIFICATION_EMAIL: Record<NotificationType, { action: string | null; note?: string }> = {
  'team.invitation_accepted': { action: 'Open workspace' },
  'team.mentioned_comment': { action: 'Read and reply' },
  'team.mentioned_chat': { action: 'Open chat' },
  'team.comment_reply': { action: 'Read and reply' },

  'sales.quote_viewed': { action: 'Open quote' },
  'sales.quote_accepted': {
    action: 'Open quote',
    note: 'You can turn an accepted quote into an invoice from the quote itself.',
  },
  'sales.quote_rejected': { action: 'Open quote' },
  'sales.quote_expired': {
    action: 'Open quote',
    note: 'Need to keep it on the table? Duplicate it and send a fresh one with a new expiry date.',
  },
  'sales.invoice_viewed': { action: 'Open invoice' },
  'sales.invoice_paid': { action: 'Open invoice' },
  'sales.invoice_overdue': {
    action: 'Open invoice',
    note: 'Resending the invoice from its page emails the client the same document with its payment link.',
  },

  'meetings.booked': { action: 'Open meetings', note: 'It is on your BorsFlow calendar.' },
  'meetings.rescheduled': { action: 'Open meetings', note: 'Your BorsFlow calendar already shows the new time.' },
  'meetings.cancelled': { action: null, note: 'Nothing to do — it is off your calendar.' },
  'meetings.reminder': { action: 'Open meetings' },

  'tasks.card_assigned': { action: 'Open board' },
  'tasks.card_due_soon': { action: 'Open board' },
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
export function formatNotificationTime({ at, timeZone }: NotificationTime): string {
  // Spelled out as components rather than dateStyle/timeStyle: ECMA-402 rejects
  // combining those with timeZoneName, and naming the zone is the whole point.
  const format = (zone: string) =>
    new Intl.DateTimeFormat('en-GB', {
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
}

/**
 * Render one notification as `{ html, text }`.
 *
 * The title is the heading rather than a line of body copy: callers already
 * write it as a full statement ("Acme accepted quote Q-2026-004"), and it is
 * also the subject, so heading and subject matching is what makes the mail
 * recognisable once it is open.
 */
export function renderNotificationEmail(input: NotificationEmailInput): { html: string; text: string } {
  const { action, note } = NOTIFICATION_EMAIL[input.type];
  const categoryLabel = CATEGORY_LABELS[TYPE_CATEGORY[input.type]].label;
  const firstName = input.recipient.name?.trim().split(/\s+/)[0];
  const greeting = firstName ? `Hi ${firstName},` : 'Hi,';
  const url = input.href ? absoluteUrl(input.href) : undefined;

  // Where and when, on one line, so the heading does not have to repeat it.
  const context: string[] = [];
  if (input.workspaceName) context.push(`In ${input.workspaceName}`);
  if (input.when) context.push(formatNotificationTime(input.when));
  const contextLine = context.join(' · ');

  const quoted = input.body ? excerpt(input.body) : '';

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

  const html = renderEmail({
    title: input.title,
    preheader: escapeHtml(preheader),
    heading: escapeHtml(input.title),
    body: bodyHtml,
    action: action && url ? { label: action, url: escapeHtml(url) } : undefined,
    note: note ? escapeHtml(note) : undefined,
    footer:
      `Sent to ${escapeHtml(input.recipient.email)} because ${escapeHtml(
        categoryLabel
      )} notifications are on for your BorsFlow account. ` +
      `<a href="${escapeHtml(absoluteUrl(PREFS_PATH))}" style="color:${EMAIL.muted};">Change what you're emailed</a>.`,
  });

  // Blocks, not lines: each entry is separated by a blank line, which is what
  // keeps the quoted excerpt and the link readable in a text-only client.
  const blocks = [`${greeting}\n\n${input.title}`];
  if (contextLine) blocks.push(contextLine);
  if (quoted) blocks.push(`"${quoted}"`);
  if (action && url) blocks.push(`${action}: ${url}`);
  if (note) blocks.push(note);
  blocks.push(
    `—\nSent to ${input.recipient.email} because ${categoryLabel} notifications are on for your BorsFlow account.\n` +
      `Change what you're emailed: ${absoluteUrl(PREFS_PATH)}`
  );
  const text = blocks.join('\n\n');

  return { html, text };
}
