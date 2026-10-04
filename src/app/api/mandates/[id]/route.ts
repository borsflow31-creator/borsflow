import { capacityError } from '@/lib/billing/capacity'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getMandateAccess } from '@/lib/crm/access'
import { updateMandate, mandateInclude } from '@/lib/services/mandates'
import { publicMandateUrl } from '@/lib/crm/public-links'
import { failure, readBody, INVALID_BODY } from '@/lib/api/respond'

export const dynamic = 'force-dynamic'

type Params = { params: { id: string } }

// GET /api/mandates/[id] — with its price history, newest first.
export async function GET(_request: NextRequest, { params }: Params) {
  try {
    const result = await getMandateAccess(params.id)
    if ('error' in result) return result.error
    const { access } = result

    const mandate = await prisma.mandate.findUniqueOrThrow({
      where: { id: params.id },
      include: { ...mandateInclude, priceChanges: { orderBy: { changedAt: 'desc' } } },
    })

    return NextResponse.json({
      mandate: { ...mandate, shareUrl: mandate.publicToken ? publicMandateUrl(mandate.publicToken) : null },
      role: access.role,
      canWrite: access.role !== 'viewer',
    })
  } catch (error) {
    return failure(error, 'Failed to fetch mandate', 'Error fetching mandate')
  }
}

// PUT/PATCH /api/mandates/[id]
async function update(request: NextRequest, { params }: Params) {
  try {
    const result = await getMandateAccess(params.id, { write: true })
    if ('error' in result) return result.error
    const { access } = result

    const body = await readBody(request)
    if (!body) return INVALID_BODY()

    // Going live is what counts against the plan; moving between other states does not.
    if (body.status === 'active') {
      const current = await prisma.mandate.findUnique({ where: { id: params.id }, select: { status: true } })
      if (current && current.status !== 'active') {
        const full = await capacityError(access.workspaceId, 'activeMandates')
        if (full) return full
      }
    }

    const mandate = await updateMandate(params.id, { workspaceId: access.workspaceId, userId: access.userId }, body)
    return NextResponse.json({ mandate })
  } catch (error) {
    return failure(error, 'Failed to update mandate', 'Error updating mandate')
  }
}
export const PUT = update
export const PATCH = update

// DELETE /api/mandates/[id]
export async function DELETE(_request: NextRequest, { params }: Params) {
  try {
    const result = await getMandateAccess(params.id, { write: true })
    if ('error' in result) return result.error
    const { access } = result

    if (!access.canModerate && access.record.ownerId !== access.userId) {
      return NextResponse.json({ error: 'Only the listing agent or an admin can delete this mandate' }, { status: 403 })
    }

    await prisma.mandate.delete({ where: { id: params.id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    return failure(error, 'Failed to delete mandate', 'Error deleting mandate')
  }
}
