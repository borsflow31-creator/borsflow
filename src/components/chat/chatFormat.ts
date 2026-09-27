export function getInitials(name: string) {
  return name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2)
}

export function formatTime(iso: string) {
  const d = new Date(iso)
  const now = new Date()
  const isToday = d.toDateString() === now.toDateString()
  const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  return isToday ? time : d.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' · ' + time
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
  directory: Record<string, { name: string | null; email: string }>,
  fallback?: { name?: string | null; email?: string | null },
) {
  const known = directory[userId]
  if (known) return known.name ?? known.email
  return fallback?.name ?? fallback?.email ?? 'Unknown member'
}

/**
 * fileUrl reaches other clients through client-controlled Ably metadata (and the archive
 * POST), so only allow what our upload route produces or plain https links. Anything else,
 * e.g. a `javascript:` URL, is dropped rather than rendered into an href.
 */
export function safeFileUrl(url: unknown): string | null {
  if (typeof url !== 'string') return null
  if (url.startsWith('/uploads/') || /^https:\/\//i.test(url)) return url
  return null
}
