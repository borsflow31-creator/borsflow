import { getSupabaseAdmin, CRM_BUCKET } from '@/lib/supabase-admin'

/**
 * Short-lived signed URLs for listing media.
 *
 * The bucket is private. An agent's own screens sign each image for an hour --
 * long enough to work on a listing, short enough that a copied URL soon dies.
 * Public pages and portal feeds never get these: they go through the proxy route
 * that signs per request, so what a portal stores is a stable app URL, not a link
 * that rots.
 */
export const MEDIA_URL_TTL_SECONDS = 60 * 60

/** path -> signed URL, for every path that could be signed. Missing storage yields an empty map. */
export async function signMediaPaths(
  paths: (string | null | undefined)[],
  ttl = MEDIA_URL_TTL_SECONDS
): Promise<Map<string, string>> {
  const unique = Array.from(new Set(paths.filter((p): p is string => !!p)))
  const urls = new Map<string, string>()
  if (unique.length === 0) return urls

  const supabase = getSupabaseAdmin()
  if (!supabase) return urls

  const { data, error } = await supabase.storage.from(CRM_BUCKET).createSignedUrls(unique, ttl)
  if (error || !data) {
    console.error('[properties/media] signing failed:', error?.message)
    return urls
  }
  for (const entry of data) {
    if (entry.path && entry.signedUrl) urls.set(entry.path, entry.signedUrl)
  }
  return urls
}
