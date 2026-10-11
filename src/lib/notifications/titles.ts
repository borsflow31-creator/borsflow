/**
 * Notification titles and bodies in the reader's language (the bell, and the emails).
 *
 * A notification's title is stored as English text when the event happens, by a
 * server that does not know who will read it or in which language. The bell
 * recognises the titles the system writes (the templates below, which mirror the
 * `notify()` calls) and shows `notificationTitles.<key>` instead; a title that
 * matches nothing is shown as stored. Same approach as ../crm/task-titles.
 *
 * Order matters: the first template that matches wins, so the specific ones come
 * before the general ones.
 */
import type { MessageKey } from '@/i18n/I18nProvider'
import { localizeTaskTitle } from '@/lib/crm/task-titles'

const TEMPLATES: Array<[key: string, template: string]> = [
  // Real estate developer
  ['notContacted', '{name} has not been contacted'],
  ['behindTarget', '{project} is behind its sales target'],
  ['lowStock', '{project} is running low on stock'],
  ['highCancellations', '{project} has a high cancellation rate'],
  ['unitReserved', 'Unit {unit} reserved in {project}'],
  ['unitUnderContract', 'Unit {unit} under contract in {project}'],
  ['overduePayment', 'Overdue payment: unit {unit}'],
  ['documentAccepted', '{number} accepted by {name}'],
  ['followUpWith', 'Follow up with {name}'],
  ['cardDueSoon', 'Due soon: "{title}"'],
  ['taskOverdue', 'Overdue: {task}'],
  ['taskDueSoon', 'Due soon: {task}'],
  // Agency
  ['mandateEndsTomorrow', 'Mandate {reference} on {property} ends in 1 day'],
  ['mandateEnds', 'Mandate {reference} on {property} ends in {days} days'],
  ['buyerMatches', '1 buyer match {property}'],
  ['buyersMatch', '{count} buyers match {property}'],
  ['viewingFeedback', 'Viewing feedback on {property}'],
  // Everyone
  ['invoiceOverdue', 'Invoice {number} for {client} is overdue'],
  ['quoteExpired', 'Quote {number} for {client} expired'],
  ['invoiceViewed', '{client} viewed invoice {number}'],
  ['quoteViewed', '{client} viewed quote {number}'],
  ['quoteAccepted', '{client} accepted quote {number}'],
  ['quoteRejected', '{client} rejected quote {number}'],
  ['meetingStartingSoon', 'Starting soon: {title}'],
  ['meetingBooked', 'Meeting booked: {title}'],
  ['meetingRescheduled', 'Meeting rescheduled: {title}'],
  ['meetingCancelled', 'Meeting cancelled: {title}'],
  ['assigned', 'You were assigned to "{title}"'],
  ['mentionedInComment', '{name} mentioned you in a comment'],
  ['repliedToComment', '{name} replied to your comment'],
  ['mentionedInChannel', '{name} mentioned you in #{channel}'],
  ['joined', '{name} joined {workspace}'],
]

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** The bodies the system writes, translated as `notificationBodies.<key>`. */
const BODY_TEMPLATES: Array<[key: string, template: string]> = [
  ['noResponse', 'A new buyer arrived over {minutes} minutes ago and nobody has logged a call, a visit or a follow-up.'],
  ['noFollowUp', 'Nothing has been booked with this buyer for {days} days, so a follow-up was added for you.'],
  ['forBuyer', 'For {buyer}.'],
  ['unit', 'Unit {unit}'],
  ['behindTarget', '{sold} of {target} units sold; the plan expected about {expected} by now.'],
  ['lowStock', 'Only {available} of {total} units are still available.'],
  ['cancellations', '{cancelled} of {deals} deals in the last {days} days were cancelled.'],
]

const compile = (templates: Array<[key: string, template: string]>) => templates.map(([key, template]) => {
  const names: string[] = []
  const source = template
    .split(/(\{\w+\})/)
    .map((part) => {
      const name = part.match(/^\{(\w+)\}$/)?.[1]
      if (!name) return escape(part)
      names.push(name)
      return '(.+?)'
    })
    .join('')
  return { key, names, pattern: new RegExp(`^${source}$`) }
})

const MATCHERS = compile(TEMPLATES)
const BODY_MATCHERS = compile(BODY_TEMPLATES)

type Translate = (key: MessageKey, params?: Record<string, string | number>) => string

/** The title in the reader's language: a system title translated, anything else as stored. */
export function localizeNotificationTitle(title: string, t: Translate): string {
  for (const { key, names, pattern } of MATCHERS) {
    const match = title.match(pattern)
    if (!match) continue
    const params: Record<string, string> = Object.fromEntries(names.map((n, i) => [n, match[i + 1]]))
    // A follow-up reminder quotes the task's title, which may itself be a system one.
    if (params.task) params.task = localizeTaskTitle(params.task, t)
    return t(`notificationTitles.${key}` as MessageKey, params)
  }
  return title
}

/** A body the system wrote, translated; anything else (a comment, a reason someone typed) as stored. */
export function localizeNotificationBody(body: string, t: Translate): string {
  for (const { key, names, pattern } of BODY_MATCHERS) {
    const match = body.match(pattern)
    if (match) return t(`notificationBodies.${key}` as MessageKey, Object.fromEntries(names.map((n, i) => [n, match[i + 1]])))
  }
  return body
}
