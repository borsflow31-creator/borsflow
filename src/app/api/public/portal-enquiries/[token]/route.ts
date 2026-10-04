/**
 * Inbound portal enquiries.
 *
 * A portal forwards the enquiries it receives for an agency's listings to this URL.
 * The feed token authenticates the portal and says which agency it is posting for, and
 * the enquiry lands through the same intake as the website form and manual entry --
 * de-duplicated by address, attached to the property named, logged, and starting any
 * lead_created automation -- with the portal recorded as its source.
 *
 * Portals each post a different payload. This accepts a flat JSON object with the
 * common field names; a portal that needs a different shape needs a translation step
 * in front of it (see the note in src/lib/crm/portal-feed.ts about portal onboarding).
 */

export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { consumeRateLimits, rateLimitedResponse } from '@/lib/api/rate-limit'
import { PORTAL_ENQUIRY_RATE_LIMIT } from '@/lib/crm/public-links'
import { receiveEnquiry } from '@/lib/services/intake'
import { ServiceError } from '@/lib/services/errors'

const MAX_BODY_BYTES = 16 * 1024

export async function POST(request: NextRequest, { params }: { params: { token: string } }) {
  try {
    const limit = await consumeRateLimits([{ subject: `portal-enquiry:${params.token}`, rule: PORTAL_ENQUIRY_RATE_LIMIT }])
    if (!limit.allowed) return rateLimitedResponse(limit, 1, { noun: 'enquiry', verb: 'send' })

    const raw = await request.text()
    if (raw.length > MAX_BODY_BYTES) return NextResponse.json({ error: 'Request too large' }, { status: 413 })
    let body: Record<string, unknown>
    try {
      const parsed = JSON.parse(raw)
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('not an object')
      body = parsed as Record<string, unknown>
    } catch {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }

    const feed = await prisma.portalFeed.findUnique({ where: { token: params.token }, select: { workspaceId: true, portal: true, isActive: true } })
    if (!feed || !feed.isActive) return NextResponse.json({ error: 'This feed is not available' }, { status: 404 })

    const outcome = await receiveEnquiry({
      workspaceId: feed.workspaceId,
      channel: 'portal',
      portal: feed.portal,
      firstName: (body.firstName ?? body.first_name ?? body.name) as string,
      lastName: (body.lastName ?? body.last_name) as string,
      email: body.email as string,
      phone: (body.phone ?? body.telephone) as string,
      message: (body.message ?? body.comment) as string,
      propertyReference: (body.reference ?? body.propertyReference ?? body.agent_ref) as string,
    })
    return NextResponse.json({ ok: true, created: outcome.created })
  } catch (error) {
    if (error instanceof ServiceError) return NextResponse.json({ error: error.message }, { status: error.status })
    console.error('Error receiving portal enquiry:', error)
    return NextResponse.json({ error: 'Failed to record the enquiry' }, { status: 500 })
  }
}
