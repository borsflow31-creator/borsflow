/**
 * Media for one project: photos, drone shots, renders, plans, videos and the
 * brochures a promoter hands buyers.
 *
 * The same shape as the listing media route, and deliberately so -- the two
 * share their rules through lib/crm/media-storage, so what a browser will render
 * and how big a file may be cannot drift between a listing and a development.
 * They stay separate routes because they have different parents and different
 * tables.
 *
 * Access comes from the program record, not from a workspaceId the caller sends,
 * which is the convention in lib/crm/access.
 */
import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { prisma } from '@/lib/prisma'
import { getSupabaseAdmin, CRM_BUCKET } from '@/lib/supabase-admin'
import { consumeRateLimits, rateLimitedResponse } from '@/lib/api/rate-limit'
import { contentMatchesType } from '@/lib/uploads'
import { getProgramAccess } from '@/lib/crm/access'
import { signMediaPaths } from '@/lib/crm/media-urls'
import { failure } from '@/lib/api/respond'
import {
  MAX_MEDIA_PER_PROGRAM,
  MEDIA_UPLOAD_RATE_LIMIT,
  maxSizeForKind,
  mediaStoragePrefix,
  typesForKind,
  verifyStoredObject,
} from '@/lib/crm/media-storage'
import {
  PROGRAM_FILE_MEDIA_KINDS,
  PROGRAM_LINK_MEDIA_KINDS,
  isProgramMediaKind,
  storageKindFor,
} from '@/lib/crm/projects'

export const dynamic = 'force-dynamic'

type Params = { params: { id: string } }

const mediaSelect = {
  id: true, kind: true, filePath: true, externalUrl: true, fileName: true, fileType: true, size: true,
  title: true, caption: true, position: true, isCover: true,
  isConstructionUpdate: true, updateMonth: true, createdAt: true,
} as const

// GET /api/developer/programs/[id]/media — ordered, each file with a signed URL.
export async function GET(_request: NextRequest, { params }: Params) {
  try {
    const result = await getProgramAccess(params.id)
    if ('error' in result) return result.error
    const { access } = result

    const rows = await prisma.programMedia.findMany({
      where: { programId: params.id },
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
    return failure(error, 'Failed to fetch media', 'Error fetching project media')
  }
}

/** The next position, and whether this item should be the cover. */
async function placement(programId: string, kind: string) {
  const [last, cover] = await Promise.all([
    prisma.programMedia.findFirst({ where: { programId }, orderBy: { position: 'desc' }, select: { position: true } }),
    prisma.programMedia.findFirst({ where: { programId, isCover: true }, select: { id: true } }),
  ])
  // The first image is the cover until someone picks another.
  const isImageKind = kind === 'photo' || kind === 'drone' || kind === '3d_render'
  return { position: (last?.position ?? -1) + 1, isCover: isImageKind && !cover }
}

// POST /api/developer/programs/[id]/media
//   multipart: file, kind, caption?, title?
//   json:      { kind: 'video', externalUrl, ... }                 -- a link
//   json:      { kind: 'video', filePath, fileName, fileType, ... } -- records a
//              video the browser already uploaded via media/upload-url
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

    const text = (value: unknown, max: number) =>
      typeof value === 'string' ? value.trim().slice(0, max) || null : null

    if ((request.headers.get('content-type') ?? '').includes('application/json')) {
      const body = await request.json().catch(() => null)
      const kind = body?.kind
      if (!isProgramMediaKind(kind)) return NextResponse.json({ error: 'Unknown media kind' }, { status: 400 })

      // A video the browser uploaded straight to storage: record it, once
      // storage confirms the object is really there.
      if (typeof body?.filePath === 'string' && body.filePath) {
        if (kind !== 'video') {
          return NextResponse.json({ error: 'Only a video is uploaded directly' }, { status: 400 })
        }
        const already = await prisma.programMedia.findFirst({ where: { filePath: body.filePath }, select: { id: true } })
        if (already) return NextResponse.json({ error: 'That upload is already recorded' }, { status: 409 })

        const prefix = mediaStoragePrefix('projects', access.workspaceId, params.id)
        const stored = await verifyStoredObject(body.filePath, prefix, storageKindFor(kind))
        if ('error' in stored) return NextResponse.json({ error: stored.error }, { status: 400 })

        const place = await placement(params.id, kind)
        const saved = await prisma.programMedia.create({
          data: {
            programId: params.id,
            workspaceId: access.workspaceId,
            kind,
            filePath: body.filePath,
            fileName: text(body.fileName, 255),
            fileType: stored.contentType,
            size: stored.size,
            title: text(body.title, 200),
            caption: text(body.caption, 300),
            position: place.position,
            uploadedById: access.userId,
          },
          select: mediaSelect,
        })
        const urls = await signMediaPaths([saved.filePath])
        const { filePath: _stored, ...rest } = saved
        return NextResponse.json({ media: { ...rest, url: urls.get(body.filePath) ?? null } }, { status: 201 })
      }

      if (!PROGRAM_LINK_MEDIA_KINDS.includes(kind)) {
        return NextResponse.json({ error: 'A link must be a video' }, { status: 400 })
      }
      const externalUrl = typeof body?.externalUrl === 'string' ? body.externalUrl.trim() : ''
      let parsed: URL | null = null
      try { parsed = new URL(externalUrl) } catch { /* handled below */ }
      // https only: the link is rendered in a page, so a javascript: or data:
      // URL would be script injection.
      if (!parsed || parsed.protocol !== 'https:') {
        return NextResponse.json({ error: 'Enter a valid https link' }, { status: 400 })
      }

      const place = await placement(params.id, kind)
      const saved = await prisma.programMedia.create({
        data: {
          programId: params.id,
          workspaceId: access.workspaceId,
          kind,
          externalUrl: parsed.toString(),
          title: text(body?.title, 200),
          caption: text(body?.caption, 300),
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
    let title: string | null = null
    try {
      const form = await request.formData()
      const entry = form.get('file')
      file = entry && typeof entry !== 'string' ? entry : null
      const requestedKind = form.get('kind')
      if (typeof requestedKind === 'string' && requestedKind) kind = requestedKind
      caption = text(form.get('caption'), 300)
      title = text(form.get('title'), 200)
    } catch {
      return NextResponse.json({ error: 'Invalid upload' }, { status: 400 })
    }

    if (!isProgramMediaKind(kind) || !PROGRAM_FILE_MEDIA_KINDS.includes(kind)) {
      return NextResponse.json({ error: 'That kind of media cannot be uploaded as a file' }, { status: 400 })
    }
    // Video goes to storage direct; buffering 200 MB here is what upload-url exists to avoid.
    if (kind === 'video') {
      return NextResponse.json({ error: 'Request an upload URL for a video' }, { status: 400 })
    }
    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    if (file.size === 0) return NextResponse.json({ error: 'The file is empty' }, { status: 400 })

    const storageKind = storageKindFor(kind)
    const maxSize = maxSizeForKind(storageKind)
    if (file.size > maxSize) {
      return NextResponse.json({ error: `File too large (max ${Math.floor(maxSize / (1024 * 1024))} MB)` }, { status: 400 })
    }

    const ext = typesForKind(storageKind)?.[file.type]
    if (!ext) return NextResponse.json({ error: 'This file type is not allowed' }, { status: 400 })

    const buffer = Buffer.from(await file.arrayBuffer())
    if (!contentMatchesType(new Uint8Array(buffer), ext)) {
      return NextResponse.json({ error: "The file's contents don't match its type" }, { status: 400 })
    }

    const supabase = getSupabaseAdmin()
    if (!supabase) {
      console.error('[programs/media] SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not set')
      return NextResponse.json({ error: 'File uploads are not configured' }, { status: 500 })
    }

    const filePath = `${mediaStoragePrefix('projects', access.workspaceId, params.id)}/${randomUUID()}.${ext}`
    const { error } = await supabase.storage.from(CRM_BUCKET).upload(filePath, buffer, { contentType: file.type, upsert: false })
    if (error) {
      console.error('[programs/media] storage upload failed:', error.message)
      return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
    }

    const place = await placement(params.id, kind)
    const saved = await prisma.programMedia.create({
      data: {
        programId: params.id,
        workspaceId: access.workspaceId,
        kind,
        filePath,
        fileName: file.name.slice(0, 255) || `file.${ext}`,
        fileType: file.type,
        size: file.size,
        title,
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
    return failure(error, 'Failed to add media', 'Error adding project media')
  }
}

// PATCH /api/developer/programs/[id]/media  { order: [mediaId, …] } — reorder.
// Ids not in the list keep their relative order after the listed ones, so a
// stale client cannot lose an item it did not know about.
export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const result = await getProgramAccess(params.id, { write: true })
    if ('error' in result) return result.error

    const body = await request.json().catch(() => null)
    const order: unknown = body?.order
    if (!Array.isArray(order) || order.some(id => typeof id !== 'string')) {
      return NextResponse.json({ error: 'order must be a list of media ids' }, { status: 400 })
    }

    const existing = await prisma.programMedia.findMany({
      where: { programId: params.id },
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
      select: { id: true },
    })
    const known = new Set(existing.map(m => m.id))
    const requested = (order as string[]).filter((id, i, all) => known.has(id) && all.indexOf(id) === i)
    const rest = existing.map(m => m.id).filter(id => !requested.includes(id))
    const final = [...requested, ...rest]

    await prisma.$transaction(final.map((id, position) => prisma.programMedia.update({ where: { id }, data: { position } })))
    return NextResponse.json({ success: true })
  } catch (error) {
    return failure(error, 'Failed to reorder media', 'Error reordering project media')
  }
}
