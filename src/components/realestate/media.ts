/**
 * What the media components agree on, for listings and for projects alike.
 *
 * A media item is one of three things wearing the same shape: a file in the
 * private bucket (`url` is a signed link that expires), a link to a video host
 * (`externalUrl`), or a floor plan PDF. The components branch on `kind` and on
 * which of the two URLs is set, so this module is where that branching is named
 * once instead of being re-derived in each view.
 */

export interface MediaItem {
  id: string
  kind: string
  /** Signed bucket URL for an uploaded file; for a link item, the link itself. */
  url: string | null
  externalUrl: string | null
  fileName: string | null
  fileType: string | null
  caption: string | null
  isCover: boolean
  position: number
  size?: number | null
}

/** Groups shown as separate galleries, in the order an agent thinks about them. */
export const MEDIA_GROUPS = ['photo', 'video', 'floorplan', 'virtual_tour'] as const
export type MediaGroup = (typeof MEDIA_GROUPS)[number]

/** An item the agency uploaded, as opposed to a link to someone else's host. */
export function isUploaded(item: MediaItem): boolean {
  return !item.externalUrl
}

export function isImage(item: MediaItem): boolean {
  if (item.kind === 'photo') return true
  // A floor plan is an image unless it is the PDF the architect sent.
  return item.kind === 'floorplan' && item.fileType !== 'application/pdf'
}

export function isPdf(item: MediaItem): boolean {
  return item.fileType === 'application/pdf'
}

/** A video file the browser can play inline with <video>. */
export function isVideoFile(item: MediaItem): boolean {
  return item.kind === 'video' && isUploaded(item)
}

/**
 * The embeddable player URL for a hosted video, or null if we don't recognise
 * the host. Falling back to null (and so to a plain link) matters: guessing an
 * embed path for an unknown host renders a broken frame, which looks like the
 * upload failed.
 */
export function embedUrl(rawUrl: string | null): string | null {
  if (!rawUrl) return null
  let parsed: URL
  try {
    parsed = new URL(rawUrl)
  } catch {
    return null
  }
  const host = parsed.hostname.replace(/^www\./, '')

  if (host === 'youtu.be') {
    const id = parsed.pathname.slice(1)
    return id ? `https://www.youtube.com/embed/${encodeURIComponent(id)}` : null
  }
  if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'youtube-nocookie.com') {
    const watch = parsed.searchParams.get('v')
    if (watch) return `https://www.youtube.com/embed/${encodeURIComponent(watch)}`
    const path = parsed.pathname.match(/^\/(?:embed|shorts|live)\/([\w-]+)/)
    if (path) return `https://www.youtube.com/embed/${encodeURIComponent(path[1])}`
    return null
  }
  if (host === 'vimeo.com' || host === 'player.vimeo.com') {
    const id = parsed.pathname.match(/(\d+)/)
    return id ? `https://player.vimeo.com/video/${id[1]}` : null
  }
  // Matterport and similar virtual tours are already embeddable as given.
  if (host === 'my.matterport.com' || host === 'matterport.com') return rawUrl
  return null
}

/** True when the lightbox can show this item rather than just linking out. */
export function isPreviewable(item: MediaItem): boolean {
  return isImage(item) || isPdf(item) || isVideoFile(item) || !!embedUrl(item.externalUrl)
}

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}
