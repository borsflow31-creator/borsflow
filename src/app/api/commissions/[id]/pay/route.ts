import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getWorkspaceAccess } from '@/lib/crm/access'
import { markPaid } from '@/lib/services/commissions'
import { failure } from '@/lib/api/respond'

// POST /api/commissions/[id]/pay — mark a realized commission, and every share of it, paid.
export async function POST(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const commission = await prisma.commission.findUnique({ where: { id: params.id }, select: { workspaceId: true } })
    if (!commission) return NextResponse.json({ error: 'Commission not found' }, { status: 404 })

    const result = await getWorkspaceAccess(commission.workspaceId, { write: true })
    if ('error' in result) return result.error
    const { access } = result

    const updated = await markPaid(params.id, { workspaceId: commission.workspaceId, userId: access.userId, canModerate: access.canModerate })
    return NextResponse.json({ commission: updated })
  } catch (error) {
    return failure(error, 'Failed to mark the commission paid', 'Error marking commission paid')
  }
}
