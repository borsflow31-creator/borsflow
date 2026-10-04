import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getPropertyAccess } from '@/lib/crm/access'
import { failure } from '@/lib/api/respond'

export const dynamic = 'force-dynamic'

function safeParse(raw: string) {
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

// GET /api/properties/[id]/activity — everything that happened on this property,
// newest first: stage and status changes, price changes, mandates, offers, and
// the viewings and their feedback.
export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const result = await getPropertyAccess(params.id)
    if ('error' in result) return result.error

    const activities = await prisma.activity.findMany({
      where: { propertyId: params.id },
      orderBy: { createdAt: 'desc' },
      take: 200,
      select: {
        id: true, type: true, entityType: true, entityId: true, description: true, metadata: true, createdAt: true,
        user: { select: { id: true, name: true, email: true } },
      },
    })

    return NextResponse.json({
      activities: activities.map(a => ({ ...a, metadata: a.metadata ? safeParse(a.metadata) : null })),
    })
  } catch (error) {
    return failure(error, 'Failed to fetch activity', 'Error fetching property activity')
  }
}
