import { capacityError } from '@/lib/billing/capacity'
import { NextRequest, NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getWorkspaceAccess } from '@/lib/crm/access'
import { MANDATE_EXPIRY_WINDOW_DAYS } from '@/lib/crm/lifecycle'
import { expiringMandatesWhere } from '@/lib/crm/mandate-watch'
import { createMandate, mandateInclude } from '@/lib/services/mandates'
import { failure, readBody, INVALID_BODY } from '@/lib/api/respond'
import { clampInt } from '@/lib/products'

export const dynamic = 'force-dynamic'

const DAY_MS = 86_400_000

/** Whole days until a date; negative once it has passed. */
function daysUntil(date: Date | null, now = Date.now()): number | null {
  return date ? Math.ceil((date.getTime() - now) / DAY_MS) : null
}

// GET /api/mandates?workspaceId=…&queue=expiring|active|expired|all
//
// `expiring` is the renewal work queue: active mandates ending within 30 days,
// plus any active one already past its end date that the expiry sweep has not
// reached yet, soonest first. Those are the calls an agent needs to make today.
export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams
    const workspaceId = params.get('workspaceId')
    if (!workspaceId) return NextResponse.json({ error: 'Workspace ID is required' }, { status: 400 })

    const result = await getWorkspaceAccess(workspaceId)
    if ('error' in result) return result.error
    const { access } = result

    const now = new Date()
    const expiringWhere = expiringMandatesWhere(workspaceId, now)

    const queue = params.get('queue') ?? 'all'
    const where: Prisma.MandateWhereInput =
      queue === 'expiring' ? expiringWhere
      : queue === 'active' ? { workspaceId, status: 'active' }
      : queue === 'expired' ? { workspaceId, status: 'expired' }
      : { workspaceId }

    const propertyId = params.get('propertyId')
    if (propertyId) where.propertyId = propertyId
    const leadId = params.get('leadId')
    if (leadId) where.leadId = leadId

    const limit = clampInt(params.get('limit'), 100, 1, 200)

    const [rows, expiring, active, expired] = await Promise.all([
      prisma.mandate.findMany({
        where,
        include: mandateInclude,
        orderBy: queue === 'expiring' ? [{ endDate: 'asc' }] : [{ createdAt: 'desc' }],
        take: limit,
      }),
      prisma.mandate.count({ where: expiringWhere }),
      prisma.mandate.count({ where: { workspaceId, status: 'active' } }),
      prisma.mandate.count({ where: { workspaceId, status: 'expired' } }),
    ])

    return NextResponse.json({
      mandates: rows.map(m => ({ ...m, daysToExpiry: daysUntil(m.endDate, now.getTime()) })),
      counts: { expiring, active, expired },
      windowDays: MANDATE_EXPIRY_WINDOW_DAYS,
      role: access.role,
      canWrite: access.role !== 'viewer',
    })
  } catch (error) {
    return failure(error, 'Failed to fetch mandates', 'Error fetching mandates')
  }
}

// POST /api/mandates  { workspaceId, propertyId, leadId?, … }
export async function POST(request: NextRequest) {
  try {
    const body = await readBody(request)
    if (!body) return INVALID_BODY()
    const workspaceId = typeof body.workspaceId === 'string' ? body.workspaceId : ''
    if (!workspaceId) return NextResponse.json({ error: 'Workspace ID is required' }, { status: 400 })

    const result = await getWorkspaceAccess(workspaceId, { write: true })
    if ('error' in result) return result.error

    if (body.status === 'active') {
      const full = await capacityError(workspaceId, 'activeMandates')
      if (full) return full
    }

    const mandate = await createMandate({ workspaceId, userId: result.access.userId }, body)
    return NextResponse.json({ mandate }, { status: 201 })
  } catch (error) {
    return failure(error, 'Failed to create mandate', 'Error creating mandate')
  }
}
