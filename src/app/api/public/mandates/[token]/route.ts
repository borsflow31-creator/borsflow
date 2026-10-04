/**
 * Public vendor report. No session: the token is the credential, and a revoked or
 * unknown one is indistinguishable from a missing one. The report names no buyer.
 */

export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { consumeRateLimits, rateLimitedResponse } from '@/lib/api/rate-limit'
import { MANDATE_VIEW_RATE_LIMIT } from '@/lib/crm/public-links'
import { buildVendorReport } from '@/lib/crm/vendor-report'

export async function GET(_request: NextRequest, { params }: { params: { token: string } }) {
  try {
    // Before the database read: the endpoint is unauthenticated.
    const limit = await consumeRateLimits([{ subject: `mandate-token:${params.token}`, rule: MANDATE_VIEW_RATE_LIMIT }])
    if (!limit.allowed) return rateLimitedResponse(limit, 1)

    const mandate = await prisma.mandate.findUnique({ where: { publicToken: params.token }, select: { id: true } })
    if (!mandate) return NextResponse.json({ error: 'This link is no longer valid' }, { status: 404 })

    const report = await buildVendorReport(mandate.id)
    if (!report) return NextResponse.json({ error: 'This link is no longer valid' }, { status: 404 })

    return NextResponse.json({ report })
  } catch (error) {
    console.error('Error fetching vendor report:', error)
    return NextResponse.json({ error: 'Failed to load this report' }, { status: 500 })
  }
}
