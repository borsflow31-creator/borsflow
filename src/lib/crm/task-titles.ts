/**
 * Titles of the follow-ups the system creates on its own (after a reservation, a
 * site visit, a logged call, an alert...).
 *
 * A task's title is stored as text, and the server that writes it does not know
 * who will read it or in which language. So the system's titles are always
 * written from these English templates, and the screens recognise them and show
 * the reader's translation (`developerAutoTasks.<key>`). A title someone typed
 * matches no template and is shown as typed. Tasks created before this module
 * used the same wording, so they translate too.
 *
 * Pure data, no imports beyond types: the services and the client share it.
 */
import type { MessageKey } from '@/i18n/I18nProvider'

const TEMPLATES = {
  reservationFollowUp: 'Follow up on the reservation of {unit}',
  countersignedCopy: 'Send the countersigned copy of {number}',
  followUpWith: 'Follow up with {name}',
  callBack: 'Call {name} back',
  visitFollowUp: 'Follow up after the site visit ({name})',
  visitRebook: 'Rebook the missed site visit ({name})',
} as const

export type AutoTaskKey = keyof typeof TEMPLATES

/** The stored (English) title for a system task. */
export function autoTaskTitle(key: AutoTaskKey, params: Record<string, string>): string {
  return TEMPLATES[key].replace(/\{(\w+)\}/g, (_, name: string) => params[name] ?? '')
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** Each template as a pattern that captures its parameters by name. */
const MATCHERS = (Object.keys(TEMPLATES) as AutoTaskKey[]).map((key) => {
  const names: string[] = []
  const source = TEMPLATES[key]
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

/** If `title` is one of the system's, which one and with what parameters. */
export function parseAutoTaskTitle(title: string): { key: AutoTaskKey; params: Record<string, string> } | null {
  for (const { key, names, pattern } of MATCHERS) {
    const match = title.match(pattern)
    if (match) return { key, params: Object.fromEntries(names.map((n, i) => [n, match[i + 1]])) }
  }
  return null
}

/** The title in the reader's language: a system title translated, anything else as typed. */
export function localizeTaskTitle(
  title: string,
  t: (key: MessageKey, params?: Record<string, string | number>) => string
): string {
  const parsed = parseAutoTaskTitle(title)
  return parsed ? t(`developerAutoTasks.${parsed.key}` as MessageKey, parsed.params) : title
}
