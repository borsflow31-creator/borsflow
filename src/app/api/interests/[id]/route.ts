import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getInterestAccess } from '@/lib/crm/access'
import { interestInclude, updateInterest } from '@/lib/services/interests'
import { failure, readBody, INVALID_BODY } from '@/lib/api/respond'

export const dynamic = 'force-dynamic'

type Params = { params: { id: string } }

// GET /api/interests/[id]
export async function GET(_request: NextRequest, { params }: Params) {
  try {
    const result = await getInterestAccess(params.id)
    if ('error' in result) return result.error
    const { access } = result

    const interest = await prisma.interest.findUniqueOrThrow({
      where: { id: params.id },
      include: {
        ...interestInclude,
        offers: { orderBy: { offeredAt: 'desc' } },
        viewingFeedback: { orderBy: { createdAt: 'desc' } },
      },
    })
    return NextResponse.json({ interest, role: access.role, canWrite: access.role !== 'viewer' })
  } catch (error) {
    return failure(error, 'Failed to fetch interest', 'Error fetching interest')
  }
}

// PUT/PATCH /api/interests/[id]
// A drag on the buyer board sends { stage, order }; the detail view sends fields.
async function update(request: NextRequest, { params }: Params) {
  try {
    const result = await getInterestAccess(params.id, { write: true })
    if ('error' in result) return result.error
    const { access } = result

    const body = await readBody(request)
    if (!body) return INVALID_BODY()

    const interest = await updateInterest(params.id, { workspaceId: access.workspaceId, userId: access.userId }, body)
    return NextResponse.json({ interest })
  } catch (error) {
    return failure(error, 'Failed to update interest', 'Error updating interest')
  }
}
export const PUT = update
export const PATCH = update

// DELETE /api/interests/[id] — detaches the buyer from the property. Their offers
// on it go too; the contact itself is untouched.
export async function DELETE(_request: NextRequest, { params }: Params) {
  try {
    const result = await getInterestAccess(params.id, { write: true })
    if ('error' in result) return result.error

    await prisma.interest.delete({ where: { id: params.id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    return failure(error, 'Failed to remove interest', 'Error removing interest')
  }
}
