import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getPropertyAccess } from '@/lib/crm/access'
import { CrmLogger } from '@/lib/crm/logger'
import { getSupabaseAdmin, CRM_BUCKET } from '@/lib/supabase-admin'
import { propertyInclude, updateProperty } from '@/lib/services/properties'
import { daysOnMarket, parseStages } from '@/lib/crm/lifecycle'
import { failure, readBody, INVALID_BODY } from '@/lib/api/respond'

export const dynamic = 'force-dynamic'

type Params = { params: { id: string } }

// GET /api/properties/[id]
export async function GET(_request: NextRequest, { params }: Params) {
  try {
    const result = await getPropertyAccess(params.id)
    if ('error' in result) return result.error
    const { access } = result

    const property = await prisma.property.findUniqueOrThrow({
      where: { id: params.id },
      include: {
        ...propertyInclude,
        pipeline: { select: { id: true, name: true, stages: true } },
      },
    })

    const { pipeline, ...rest } = property
    return NextResponse.json({
      property: {
        ...rest,
        pipeline: pipeline ? { id: pipeline.id, name: pipeline.name } : null,
        stages: parseStages(pipeline?.stages),
        daysOnMarket: daysOnMarket(property.listedAt),
      },
      role: access.role,
      canWrite: access.role !== 'viewer',
      canModerate: access.canModerate,
    })
  } catch (error) {
    return failure(error, 'Failed to fetch property', 'Error fetching property')
  }
}

// PUT/PATCH /api/properties/[id]
// A drag on the owner board sends { stage, order }; the form sends fields. Both
// go through updateProperty, which keeps status and stage in step.
async function update(request: NextRequest, { params }: Params) {
  try {
    const result = await getPropertyAccess(params.id, { write: true })
    if ('error' in result) return result.error
    const { access } = result

    const body = await readBody(request)
    if (!body) return INVALID_BODY()

    const updated = await updateProperty(params.id, { workspaceId: access.workspaceId, userId: access.userId }, body)
    return NextResponse.json({ property: updated.property })
  } catch (error) {
    return failure(error, 'Failed to update property', 'Error updating property')
  }
}
export const PUT = update
export const PATCH = update

// DELETE /api/properties/[id] — its mandates, interests, offers and media rows go with it.
export async function DELETE(_request: NextRequest, { params }: Params) {
  try {
    const result = await getPropertyAccess(params.id, { write: true })
    if ('error' in result) return result.error
    const { access } = result

    // Only the owner and admins, or the agent who holds the listing, may delete one.
    if (!access.canModerate && access.record.ownerId !== access.userId) {
      return NextResponse.json({ error: 'Only the listing agent or an admin can delete this property' }, { status: 403 })
    }

    const media = await prisma.propertyMedia.findMany({ where: { propertyId: params.id, filePath: { not: null } }, select: { filePath: true } })
    await prisma.property.delete({ where: { id: params.id } })

    // Storage is best-effort after the row is gone: an orphaned object is
    // invisible, a row pointing at a deleted object is a broken listing.
    const paths = media.map(m => m.filePath).filter((p): p is string => !!p)
    if (paths.length) {
      const { error } = (await getSupabaseAdmin()?.storage.from(CRM_BUCKET).remove(paths)) ?? { error: null }
      if (error) console.error('[properties] storage cleanup failed:', error.message)
    }

    await CrmLogger.logEntity({
      workspaceId: access.workspaceId,
      userId: access.userId,
      type: 'property_updated',
      entityType: 'property',
      entityId: params.id,
      description: `${access.record.title} was deleted`,
      metadata: { title: access.record.title, deleted: true },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    return failure(error, 'Failed to delete property', 'Error deleting property')
  }
}
