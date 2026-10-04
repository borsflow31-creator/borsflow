/**
 * Image proxy for public listings and portal feeds.
 *
 * The storage bucket is private, so a listing image cannot be a plain bucket URL. This
 * route is the stable address that goes into a page or a portal feed: when fetched, it
 * signs a fresh, short-lived URL and redirects to it. A portal that stores this URL
 * keeps a working link for as long as the listing is public, instead of a signed URL
 * that expires in minutes -- and the bucket never has to be made public, which would
 * expose the vendor paperwork that shares it.
 */

export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { consumeRateLimits, rateLimitedResponse } from '@/lib/api/rate-limit'
import { getSupabaseAdmin, CRM_BUCKET } from '@/lib/supabase-admin'
import { LISTING_MEDIA_RATE_LIMIT } from '@/lib/crm/public-links'
import { findPublicMedia } from '@/lib/crm/public-listing'

// Long enough for the browser to fetch the redirect target, short enough that a copied
// URL soon dies.
const SIGNED_URL_TTL_SECONDS = 5 * 60

export async function GET(_request: NextRequest, { params }: { params: { token: string; mediaId: string } }) {
  try {
    const limit = await consumeRateLimits([{ subject: `listing-media:${params.token}`, rule: LISTING_MEDIA_RATE_LIMIT }])
    if (!limit.allowed) return rateLimitedResponse(limit, 1)

    const media = await findPublicMedia(params.token, params.mediaId)
    if (!media?.filePath) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const supabase = getSupabaseAdmin()
    if (!supabase) return NextResponse.json({ error: 'File storage is not configured' }, { status: 500 })

    const { data, error } = await supabase.storage.from(CRM_BUCKET).createSignedUrl(media.filePath, SIGNED_URL_TTL_SECONDS)
    if (error || !data?.signedUrl) {
      console.error('[listing/media] signed URL failed:', error?.message)
      return NextResponse.json({ error: 'Image unavailable' }, { status: 502 })
    }

    // The redirect itself may be cached briefly by a CDN; the target cannot outlive its TTL.
    return NextResponse.redirect(data.signedUrl, { headers: { 'Cache-Control': 'public, max-age=120' } })
  } catch (error) {
    console.error('Error serving listing media:', error)
    return NextResponse.json({ error: 'Failed to load this image' }, { status: 500 })
  }
}
