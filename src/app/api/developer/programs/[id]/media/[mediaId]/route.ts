import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSupabaseAdmin, CRM_BUCKET } from '@/lib/supabase-admin'
import { getProgramAccess } from '@/lib/crm/access'
import { failure } from '@/lib/api/respond'
import { canBeCover } from '@/lib/crm/projects'

export const dynamic = 'force-dynamic'

type Params = { params: { id: string; mediaId: string } }

// PATCH /api/developer/programs/[id]/media/[mediaId]  { caption?, title?, isCover?: true }
// Making an item the cover clears the previous one in the same transaction, so a
// project never has two (Prisma cannot express a partial unique index for it).
export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const result = await getProgramAccess(params.id, { write: true })
    if ('error' in result) return result.error

    const media = await prisma.programMedia.findFirst({
      where: { id: params.mediaId, programId: params.id },
      select: { id: true, kind: true },
    })
    if (!media) return NextResponse.json({ error: 'Media not found' }, { status: 404 })

    const body = await request.json().catch(() => null)
    if (!body || typeof body !== 'object') return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })

    const data: { caption?: string | null; title?: string | null } = {}
    if (body.caption !== undefined) {
      data.caption = typeof body.caption === 'string' ? body.caption.trim().slice(0, 300) || null : null
    }
    if (body.title !== undefined) {
      data.title = typeof body.title === 'string' ? body.title.trim().slice(0, 200) || null : null
    }

    if (body.isCover === true && !canBeCover(media.kind)) {
      return NextResponse.json({ error: 'Only an image can be the cover' }, { status: 400 })
    }

    await prisma.$transaction(async (tx) => {
      if (body.isCover === true) {
        await tx.programMedia.updateMany({
          where: { programId: params.id, isCover: true, id: { not: media.id } },
          data: { isCover: false },
        })
        await tx.programMedia.update({ where: { id: media.id }, data: { ...data, isCover: true } })
      } else if (Object.keys(data).length) {
        await tx.programMedia.update({ where: { id: media.id }, data })
      }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    return failure(error, 'Failed to update media', 'Error updating project media')
  }
}

// DELETE /api/developer/programs/[id]/media/[mediaId]
export async function DELETE(_request: NextRequest, { params }: Params) {
  try {
    const result = await getProgramAccess(params.id, { write: true })
    if ('error' in result) return result.error

    const media = await prisma.programMedia.findFirst({
      where: { id: params.mediaId, programId: params.id },
      select: { id: true, filePath: true, isCover: true },
    })
    if (!media) return NextResponse.json({ error: 'Media not found' }, { status: 404 })

    await prisma.programMedia.delete({ where: { id: media.id } })

    // A project without a cover has no thumbnail on the projects list: promote
    // the next image.
    if (media.isCover) {
      const next = await prisma.programMedia.findFirst({
        where: { programId: params.id, kind: { in: ['photo', 'drone', '3d_render'] } },
        orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
        select: { id: true },
      })
      if (next) await prisma.programMedia.update({ where: { id: next.id }, data: { isCover: true } })
    }

    if (media.filePath) {
      const { error } = (await getSupabaseAdmin()?.storage.from(CRM_BUCKET).remove([media.filePath])) ?? { error: null }
      if (error) console.error('[programs/media] storage delete failed:', error.message)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return failure(error, 'Failed to remove media', 'Error removing project media')
  }
}
