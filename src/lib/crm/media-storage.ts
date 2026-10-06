/**
 * What property media and project media agree on.
 *
 * The two live in different tables (PropertyMedia, ProgramMedia) with different
 * parents, so their routes stay separate -- but the rules about bytes are the
 * same rules, and a listing photo and a development photo must not be allowed to
 * diverge on what a browser will render, how big a file may be, or where in the
 * bucket it lands. Those rules live here once.
 *
 * Server-only: `verifyStoredObject` talks to storage with the service-role key.
 */
import { getSupabaseAdmin, CRM_BUCKET } from '@/lib/supabase-admin'
import { MAX_UPLOAD_SIZE, MAX_VIDEO_UPLOAD_SIZE, VIDEO_FILE_TYPES } from '@/lib/uploads'

/**
 * What a listing may hold as a file. Narrower than the lead-file allow-list on
 * purpose: these are shown to the public, so only formats a browser renders.
 */
export const IMAGE_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

/** A floor plan is usually a PDF from the architect. */
export const FLOORPLAN_TYPES: Record<string, string> = { ...IMAGE_TYPES, 'application/pdf': 'pdf' }

/** The upload allow-list for one media kind, or null if that kind takes no file. */
export function typesForKind(kind: string): Record<string, string> | null {
  if (kind === 'photo') return IMAGE_TYPES
  if (kind === 'floorplan') return FLOORPLAN_TYPES
  if (kind === 'video') return VIDEO_FILE_TYPES
  return null
}

/** The ceiling for one media kind. Video is uploaded direct-to-storage, so it is not capped by server memory. */
export function maxSizeForKind(kind: string): number {
  return kind === 'video' ? MAX_VIDEO_UPLOAD_SIZE : MAX_UPLOAD_SIZE
}

export const MAX_MEDIA_PER_PROPERTY = 100
export const MAX_MEDIA_PER_PROGRAM = 200

export const MEDIA_UPLOAD_RATE_LIMIT = { bucket: 'property:media', limit: 200, windowMs: 60 * 60 * 1000, windowLabel: 'hour' } as const

/**
 * Where one parent's files live. Scoped per workspace first, like
 * crm/<workspaceId>/<leadId>/ for leads, so a workspace's objects are one prefix
 * and deleting the parent is one `remove` of a known list.
 */
export function mediaStoragePrefix(collection: 'properties' | 'projects', workspaceId: string, parentId: string): string {
  return `crm/${workspaceId}/${collection}/${parentId}`
}

/**
 * Confirm a path the client claims it uploaded to is real, is inside this
 * parent's own prefix, and is not bigger than the kind allows.
 *
 * The browser uploads videos straight to storage, so the row is recorded by a
 * separate request. Without this check that request is a client telling the
 * database what exists: it could name another workspace's object and attach it
 * to its own listing, or name nothing at all and leave a row pointing at a gap.
 */
export async function verifyStoredObject(
  filePath: string,
  expectedPrefix: string,
  kind: string
): Promise<{ size: number; contentType: string | null } | { error: string }> {
  if (!filePath.startsWith(`${expectedPrefix}/`) || filePath.includes('..')) {
    return { error: 'That file does not belong to this record' }
  }

  const supabase = getSupabaseAdmin()
  if (!supabase) return { error: 'File uploads are not configured' }

  const { data, error } = await supabase.storage.from(CRM_BUCKET).info(filePath)
  if (error || !data) return { error: 'The upload did not complete' }

  const size = typeof data.size === 'number' ? data.size : 0
  const contentType = typeof data.contentType === 'string' ? data.contentType : null
  const drop = async (message: string) => {
    // The object is not acceptable and nothing references it yet, so it would
    // otherwise sit in the bucket forever, billed and unreachable.
    await supabase.storage.from(CRM_BUCKET).remove([filePath])
    return { error: message }
  }

  if (size <= 0) return drop('The uploaded file is empty')
  if (size > maxSizeForKind(kind)) return drop('The uploaded file is larger than allowed')

  // The type stored on the object came from the browser's own Content-Type
  // header, so it is still a claim -- but it is the type the bucket will serve
  // the file back as, which is what decides how a viewer's browser treats it.
  const allowed = typesForKind(kind)
  if (!allowed || !contentType || !allowed[contentType]) {
    return drop('The uploaded file is not a type this record accepts')
  }

  return { size, contentType }
}
