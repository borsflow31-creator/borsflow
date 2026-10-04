import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSupabaseAdmin, CRM_BUCKET } from '@/lib/supabase-admin'
import { getPropertyAccess } from '@/lib/crm/access'
import { failure } from '@/lib/api/respond'

export const dynamic = 'force-dynamic'

type Params = { params: { id: string; mediaId: string } }

// PATCH /api/properties/[id]/media/[mediaId]  { caption?, isCover?: true }
// Making an item the cover clears the previous one in the same transaction, so a
// property never has two (Prisma cannot express a partial unique index for it).
export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const result = await getPropertyAccess(params.id, { write: true })
    if ('error' in result) return result.error

    const media = await prisma.propertyMedia.findFirst({ where: { id: params.mediaId, propertyId: params.id }, select: { id: true, kind: true } })
    if (!media) return NextResponse.json({ error: 'Media not found' }, { status: 404 })

    const body = await request.json().catch(() => null)
    if (!body || typeof body !== 'object') return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })

    const data: { caption?: string | null } = {}
    if (body.caption !== undefined) {
      data.caption = typeof body.caption === 'string' ? body.caption.trim().slice(0, 300) || null : null
    }

    if (body.isCover === true && media.kind !== 'photo') {
      return NextResponse.json({ error: 'Only a photo can be the cover' }, { status: 400 })
    }

    await prisma.$transaction(async (tx) => {
      if (body.isCover === true) {
        await tx.propertyMedia.updateMany({ where: { propertyId: params.id, isCover: true, id: { not: media.id } }, data: { isCover: false } })
        await tx.propertyMedia.update({ where: { id: media.id }, data: { ...data, isCover: true } })
      } else if (Object.keys(data).length) {
        await tx.propertyMedia.update({ where: { id: media.id }, data })
      }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    return failure(error, 'Failed to update media', 'Error updating property media')
  }
}

// DELETE /api/properties/[id]/media/[mediaId]
export async function DELETE(_request: NextRequest, { params }: Params) {
  try {
    const result = await getPropertyAccess(params.id, { write: true })
    if ('error' in result) return result.error

    const media = await prisma.propertyMedia.findFirst({
      where: { id: params.mediaId, propertyId: params.id },
      select: { id: true, filePath: true, isCover: true },
    })
    if (!media) return NextResponse.json({ error: 'Media not found' }, { status: 404 })

    await prisma.propertyMedia.delete({ where: { id: media.id } })

    // A property without a cover is a listing without a thumbnail: promote the
    // next photo.
    if (media.isCover) {
      const next = await prisma.propertyMedia.findFirst({
        where: { propertyId: params.id, kind: 'photo' },
        orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
        select: { id: true },
      })
      if (next) await prisma.propertyMedia.update({ where: { id: next.id }, data: { isCover: true } })
    }

    if (media.filePath) {
      const { error } = (await getSupabaseAdmin()?.storage.from(CRM_BUCKET).remove([media.filePath])) ?? { error: null }
      if (error) console.error('[properties/media] storage delete failed:', error.message)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return failure(error, 'Failed to remove media', 'Error removing property media')
  }
}
