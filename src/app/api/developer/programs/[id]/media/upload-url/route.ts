/**
 * A signed URL the browser uploads a project video straight to storage with.
 *
 * The listing equivalent (api/properties/[id]/media/upload-url) explains why:
 * a route handler would have to buffer the whole file and the bytes would travel
 * the network twice.
 */
import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { prisma } from '@/lib/prisma'
import { getSupabaseAdmin, CRM_BUCKET } from '@/lib/supabase-admin'
import { consumeRateLimits, rateLimitedResponse } from '@/lib/api/rate-limit'
import { MAX_VIDEO_UPLOAD_SIZE, VIDEO_FILE_TYPES } from '@/lib/uploads'
import { getProgramAccess } from '@/lib/crm/access'
import { failure } from '@/lib/api/respond'
import { MAX_MEDIA_PER_PROGRAM, MEDIA_UPLOAD_RATE_LIMIT, mediaStoragePrefix } from '@/lib/crm/media-storage'

export const dynamic = 'force-dynamic'

type Params = { params: { id: string } }

// POST /api/developer/programs/[id]/media/upload-url  { fileName, fileType, size }
export async function POST(request: NextRequest, { params }: Params) {
  try {
    const result = await getProgramAccess(params.id, { write: true })
    if ('error' in result) return result.error
    const { access } = result

    const count = await prisma.programMedia.count({ where: { programId: params.id } })
    if (count >= MAX_MEDIA_PER_PROGRAM) {
      return NextResponse.json({ error: `A project can have at most ${MAX_MEDIA_PER_PROGRAM} media items` }, { status: 400 })
    }

    const limit = await consumeRateLimits([{ subject: `user:${access.userId}`, rule: MEDIA_UPLOAD_RATE_LIMIT }])
    if (!limit.allowed) return rateLimitedResponse(limit, 1, { noun: 'media upload', verb: 'make' })

    const body = await request.json().catch(() => null)
    if (!body || typeof body !== 'object') return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })

    const ext = typeof body.fileType === 'string' ? VIDEO_FILE_TYPES[body.fileType] : undefined
    if (!ext) return NextResponse.json({ error: 'A video must be MP4, WebM or MOV' }, { status: 400 })

    // The size is the browser's claim; it is checked again from the stored object
    // when the row is recorded, so a lie here only wastes the caller's own quota.
    const size = typeof body.size === 'number' ? body.size : 0
    if (size <= 0) return NextResponse.json({ error: 'The file is empty' }, { status: 400 })
    if (size > MAX_VIDEO_UPLOAD_SIZE) {
      return NextResponse.json({ error: `Video too large (max ${Math.floor(MAX_VIDEO_UPLOAD_SIZE / (1024 * 1024))} MB)` }, { status: 400 })
    }

    const supabase = getSupabaseAdmin()
    if (!supabase) {
      console.error('[programs/media/upload-url] SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not set')
      return NextResponse.json({ error: 'File uploads are not configured' }, { status: 500 })
    }

    const filePath = `${mediaStoragePrefix('projects', access.workspaceId, params.id)}/${randomUUID()}.${ext}`
    const { data, error } = await supabase.storage.from(CRM_BUCKET).createSignedUploadUrl(filePath)
    if (error || !data) {
      console.error('[programs/media/upload-url] could not sign an upload:', error?.message)
      return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
    }

    return NextResponse.json({ uploadUrl: data.signedUrl, filePath })
  } catch (error) {
    return failure(error, 'Failed to start the upload', 'Error signing a project media upload')
  }
}
