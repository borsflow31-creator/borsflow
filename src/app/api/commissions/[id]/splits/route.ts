import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getWorkspaceAccess } from '@/lib/crm/access'
import { setSplits } from '@/lib/services/commissions'
import { failure, readBody, INVALID_BODY } from '@/lib/api/respond'

// PUT /api/commissions/[id]/splits  { splits: [{ userId?, role, sharePercent, note? }] }
// Re-cut who gets what. Owner or admin only; refused once any share has been paid.
export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const commission = await prisma.commission.findUnique({ where: { id: params.id }, select: { workspaceId: true } })
    if (!commission) return NextResponse.json({ error: 'Commission not found' }, { status: 404 })

    const result = await getWorkspaceAccess(commission.workspaceId, { write: true })
    if ('error' in result) return result.error
    const { access } = result

    const body = await readBody(request)
    if (!body) return INVALID_BODY()

    const updated = await setSplits(
      params.id,
      { workspaceId: commission.workspaceId, userId: access.userId, canModerate: access.canModerate },
      body.splits
    )
    return NextResponse.json({ commission: updated })
  } catch (error) {
    return failure(error, 'Failed to update the shares', 'Error updating commission splits')
  }
}
