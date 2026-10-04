import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { prisma } from '@/lib/prisma'
import { getSupabaseAdmin, CRM_BUCKET } from '@/lib/supabase-admin'
import { consumeRateLimits, rateLimitedResponse } from '@/lib/api/rate-limit'
import { MAX_UPLOAD_SIZE, contentMatchesType } from '@/lib/uploads'
import { getPropertyAccess } from '@/lib/crm/access'
import { signMediaPaths } from '@/lib/crm/media-urls'
import { FILE_MEDIA_KINDS, isMediaKind } from '@/lib/crm/lifecycle'
import { failure } from '@/lib/api/respond'

export const dynamic = 'force-dynamic'

type Params = { params: { id: string } }

// What a listing may hold as a file. Narrower than the lead-file allow-list on
// purpose: these are shown to the public, so only formats a browser renders.
const IMAGE_TYPES: Record<string, string> = { 'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }
const FLOORPLAN_TYPES: Record<string, string> = { ...IMAGE_TYPES, 'application/pdf': 'pdf' }

const MAX_MEDIA_PER_PROPERTY = 100
const UPLOAD_LIMIT = { bucket: 'property:media', limit: 200, windowMs: 60 * 60 * 1000, windowLabel: 'hour' }

const mediaSelect = {
  id: true, kind: true, filePath: true, externalUrl: true, fileName: true, fileType: true, size: true,
  width: true, height: true, caption: true, position: true, isCover: true, createdAt: true,
} as const

// GET /api/properties/[id]/media — ordered, each file with a signed URL.
export async function GET(_request: NextRequest, { params }: Params) {
  try {
    const result = await getPropertyAccess(params.id)
    if ('error' in result) return result.error
    const { access } = result

    const rows = await prisma.propertyMedia.findMany({
      where: { propertyId: params.id },
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
      select: mediaSelect,
    })
    const urls = await signMediaPaths(rows.map(r => r.filePath))

    return NextResponse.json({
      media: rows.map(({ filePath, ...row }) => ({
        ...row,
        url: filePath ? urls.get(filePath) ?? null : row.externalUrl,
      })),
      canWrite: access.role !== 'viewer',
    })
  } catch (error) {
    return failure(error, 'Failed to fetch media', 'Error fetching property media')
  }
}

/** The next position and whether this item should be the cover. */
async function placement(propertyId: string, kind: string) {
  const [last, cover] = await Promise.all([
    prisma.propertyMedia.findFirst({ where: { propertyId }, orderBy: { position: 'desc' }, select: { position: true } }),
    prisma.propertyMedia.findFirst({ where: { propertyId, isCover: true }, select: { id: true } }),
  ])
  // The first photo is the cover until the agent picks another.
  return { position: (last?.position ?? -1) + 1, isCover: kind === 'photo' && !cover }
}

// POST /api/properties/[id]/media
//   multipart: file, kind? ('photo' | 'floorplan'), caption?
//   json:      { kind: 'video' | 'virtual_tour', externalUrl, caption? }
export async function POST(request: NextRequest, { params }: Params) {
  try {
    const result = await getPropertyAccess(params.id, { write: true })
    if ('error' in result) return result.error
    const { access } = result

    const count = await prisma.propertyMedia.count({ where: { propertyId: params.id } })
    if (count >= MAX_MEDIA_PER_PROPERTY) {
      return NextResponse.json({ error: `A property can have at most ${MAX_MEDIA_PER_PROPERTY} media items` }, { status: 400 })
    }

    const limit = await consumeRateLimits([{ subject: `user:${access.userId}`, rule: UPLOAD_LIMIT }])
    if (!limit.allowed) return rateLimitedResponse(limit, 1, { noun: 'media upload', verb: 'make' })

    // A video or virtual tour is a link, not a file.
    if ((request.headers.get('content-type') ?? '').includes('application/json')) {
      const body = await request.json().catch(() => null)
      const kind = body?.kind
      if (!isMediaKind(kind) || FILE_MEDIA_KINDS.includes(kind)) {
        return NextResponse.json({ error: 'A link must be a video or a virtual tour' }, { status: 400 })
      }
      const externalUrl = typeof body?.externalUrl === 'string' ? body.externalUrl.trim() : ''
      let parsed: URL | null = null
      try { parsed = new URL(externalUrl) } catch { /* handled below */ }
      // https only: the link is rendered in a public page, so a javascript: or
      // data: URL would be script injection.
      if (!parsed || parsed.protocol !== 'https:') {
        return NextResponse.json({ error: 'Enter a valid https link' }, { status: 400 })
      }

      const place = await placement(params.id, kind)
      const saved = await prisma.propertyMedia.create({
        data: {
          propertyId: params.id,
          workspaceId: access.workspaceId,
          kind,
          externalUrl: parsed.toString(),
          caption: typeof body?.caption === 'string' ? body.caption.trim().slice(0, 300) || null : null,
          position: place.position,
          uploadedById: access.userId,
        },
        select: mediaSelect,
      })
      return NextResponse.json({ media: { ...saved, url: saved.externalUrl } }, { status: 201 })
    }

    let file: File | null = null
    let kind = 'photo'
    let caption: string | null = null
    try {
      const form = await request.formData()
      const entry = form.get('file')
      file = entry && typeof entry !== 'string' ? entry : null
      const requestedKind = form.get('kind')
      if (typeof requestedKind === 'string' && requestedKind) kind = requestedKind
      const requestedCaption = form.get('caption')
      if (typeof requestedCaption === 'string') caption = requestedCaption.trim().slice(0, 300) || null
    } catch {
      return NextResponse.json({ error: 'Invalid upload' }, { status: 400 })
    }

    if (!isMediaKind(kind) || !FILE_MEDIA_KINDS.includes(kind)) {
      return NextResponse.json({ error: 'A file must be a photo or a floor plan' }, { status: 400 })
    }
    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    if (file.size === 0) return NextResponse.json({ error: 'The file is empty' }, { status: 400 })
    if (file.size > MAX_UPLOAD_SIZE) return NextResponse.json({ error: 'File too large (max 10 MB)' }, { status: 400 })

    const ext = (kind === 'floorplan' ? FLOORPLAN_TYPES : IMAGE_TYPES)[file.type]
    if (!ext) return NextResponse.json({ error: 'This file type is not allowed' }, { status: 400 })

    const buffer = Buffer.from(await file.arrayBuffer())
    if (!contentMatchesType(new Uint8Array(buffer), ext)) {
      return NextResponse.json({ error: "The file's contents don't match its type" }, { status: 400 })
    }

    const supabase = getSupabaseAdmin()
    if (!supabase) {
      console.error('[properties/media] SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not set')
      return NextResponse.json({ error: 'File uploads are not configured' }, { status: 500 })
    }

    // Scoped per workspace and property, like crm/<workspaceId>/<leadId>/ for leads.
    const filePath = `crm/${access.workspaceId}/properties/${params.id}/${randomUUID()}.${ext}`
    const { error } = await supabase.storage.from(CRM_BUCKET).upload(filePath, buffer, { contentType: file.type, upsert: false })
    if (error) {
      console.error('[properties/media] storage upload failed:', error.message)
      return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
    }

    const place = await placement(params.id, kind)
    const saved = await prisma.propertyMedia.create({
      data: {
        propertyId: params.id,
        workspaceId: access.workspaceId,
        kind,
        filePath,
        fileName: file.name.slice(0, 255) || `file.${ext}`,
        fileType: file.type,
        size: file.size,
        caption,
        position: place.position,
        isCover: place.isCover,
        uploadedById: access.userId,
      },
      select: mediaSelect,
    })

    const urls = await signMediaPaths([saved.filePath])
    const { filePath: _path, ...rest } = saved
    return NextResponse.json({ media: { ...rest, url: urls.get(filePath) ?? null } }, { status: 201 })
  } catch (error) {
    return failure(error, 'Failed to add media', 'Error adding property media')
  }
}

// PATCH /api/properties/[id]/media  { order: [mediaId, …] } — reorder.
// Ids not in the list keep their relative order after the listed ones, so a
// stale client cannot lose an item it did not know about.
export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const result = await getPropertyAccess(params.id, { write: true })
    if ('error' in result) return result.error

    const body = await request.json().catch(() => null)
    const order: unknown = body?.order
    if (!Array.isArray(order) || order.some(id => typeof id !== 'string')) {
      return NextResponse.json({ error: 'order must be a list of media ids' }, { status: 400 })
    }

    const existing = await prisma.propertyMedia.findMany({
      where: { propertyId: params.id },
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
      select: { id: true },
    })
    const known = new Set(existing.map(m => m.id))
    const requested = (order as string[]).filter((id, i, all) => known.has(id) && all.indexOf(id) === i)
    const rest = existing.map(m => m.id).filter(id => !requested.includes(id))
    const final = [...requested, ...rest]

    await prisma.$transaction(final.map((id, position) => prisma.propertyMedia.update({ where: { id }, data: { position } })))
    return NextResponse.json({ success: true })
  } catch (error) {
    return failure(error, 'Failed to reorder media', 'Error reordering property media')
  }
}
