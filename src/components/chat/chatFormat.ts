import type { ChatItem, MessageRow, UserDirectory } from './types'

export function getInitials(name: string) {
  return name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2)
}

export function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export function formatFullDate(iso: string) {
  return new Date(iso).toLocaleString([], { dateStyle: 'full', timeStyle: 'short' })
}

/** Calendar-day key for grouping messages under date separators. */
export function dayKey(iso: string) {
  return new Date(iso).toDateString()
}

/** "Today", "Yesterday", or a date, for the separator between days. */
export function dayLabel(iso: string, labels: { today: string; yesterday: string }) {
  const d = new Date(iso)
  const today = new Date()
  const yesterday = new Date()
  yesterday.setDate(today.getDate() - 1)
  if (d.toDateString() === today.toDateString()) return labels.today
  if (d.toDateString() === yesterday.toDateString()) return labels.yesterday
  const sameYear = d.getFullYear() === today.getFullYear()
  return d.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric', ...(sameYear ? {} : { year: 'numeric' }) })
}

export function getFileIcon(mimeType: string | null) {
  if (!mimeType) return 'attach_file'
  if (mimeType.includes('pdf')) return 'picture_as_pdf'
  if (mimeType.includes('word') || mimeType.includes('document')) return 'description'
  if (mimeType.includes('sheet') || mimeType.includes('excel')) return 'table_chart'
  if (mimeType.includes('zip')) return 'folder_zip'
  return 'attach_file'
}

/** Prefer the workspace directory (trusted) over whatever the message claims. */
export function resolveDisplayName(
  userId: string,
  directory: UserDirectory,
  fallback?: { name?: string | null; email?: string | null },
) {
  const known = directory[userId]
  if (known) return known.name ?? known.email
  return fallback?.name ?? fallback?.email ?? 'Unknown member'
}

/**
 * Only render file links our API produces (the signed-URL route) or legacy
 * https storage links. Anything else, e.g. a `javascript:` URL, is dropped.
 */
export function safeFileUrl(url: unknown): string | null {
  if (typeof url !== 'string') return null
  if (url.startsWith('/api/workspaces/') || /^https:\/\//i.test(url)) return url
  return null
}

export function rowToItem(row: MessageRow, directory: UserDirectory): ChatItem {
  return {
    key: row.id,
    id: row.id,
    text: row.content,
    userId: row.userId,
    displayName: resolveDisplayName(row.userId, directory, row.user),
    fileUrl: safeFileUrl(row.fileUrl),
    fileName: row.fileName,
    fileType: row.fileType,
    createdAt: row.createdAt,
    editedAt: row.editedAt,
    deletedAt: row.deletedAt,
    pinnedAt: row.pinnedAt,
    replyCount: row.replyCount,
    reactions: row.reactions,
  }
}

/* ─── Message text: links and @mentions ───────────────────────────────────── */

export type TextPart =
  | { kind: 'text'; value: string }
  | { kind: 'link'; value: string; href: string }
  | { kind: 'mention'; userId: string }

const TOKEN = /(<@[A-Za-z0-9_-]{1,64}>)|(https?:\/\/[^\s<]+[^\s<.,:;"')\]!?])|(www\.[^\s<]+[^\s<.,:;"')\]!?])/g

/**
 * Splits message text into plain text, links and mentions. Rendered as React
 * nodes (never HTML), so nothing in a message can inject markup.
 */
export function parseMessageText(text: string): TextPart[] {
  const parts: TextPart[] = []
  let last = 0
  for (const m of Array.from(text.matchAll(TOKEN))) {
    const at = m.index ?? 0
    if (at > last) parts.push({ kind: 'text', value: text.slice(last, at) })
    if (m[1]) parts.push({ kind: 'mention', userId: m[1].slice(2, -1) })
    else if (m[2]) parts.push({ kind: 'link', value: m[2], href: m[2] })
    else if (m[3]) parts.push({ kind: 'link', value: m[3], href: `https://${m[3]}` })
    last = at + m[0].length
  }
  if (last < text.length) parts.push({ kind: 'text', value: text.slice(last) })
  return parts
}

/** Plain-text version with mentions shown as names (copying, previews). */
export function plainText(text: string, directory: UserDirectory) {
  return text.replace(/<@([A-Za-z0-9_-]{1,64})>/g, (_, id) => `@${directory[id]?.name ?? directory[id]?.email ?? 'someone'}`)
}

export const QUICK_REACTIONS = ['👍', '❤️', '😂', '🎉', '😮', '😢', '🙏', '👀', '✅', '🔥'] as const

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024
