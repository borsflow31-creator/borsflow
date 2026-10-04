/**
 * Public enquiry intake: the endpoint an agency's website form posts to.
 *
 * Unauthenticated by nature, so everything that makes an open write endpoint safe
 * is here: a honeypot, a payload cap, rate limits per address and per workspace
 * (RateLimitEvent), validation, and a response that reveals nothing about what
 * already exists. Creating the lead goes through receiveEnquiry, the same intake
 * the portal webhooks and the agent's own entry use.
 *
 * Cross-origin on purpose: the form lives on the agency's own site.
 */

export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { consumeRateLimits, rateLimitedResponse } from '@/lib/api/rate-limit'
import { prisma } from '@/lib/prisma'
import { receiveEnquiry } from '@/lib/services/intake'
import { ServiceError } from '@/lib/services/errors'

/** A real enquiry is a few hundred bytes; anything near this is not one. */
const MAX_BODY_BYTES = 16 * 1024

const PER_IP = { bucket: 'enquiry:ip', limit: 10, windowMs: 60 * 60 * 1000, windowLabel: 'hour' } as const
const PER_WORKSPACE = { bucket: 'enquiry:workspace', limit: 300, windowMs: 60 * 60 * 1000, windowLabel: 'hour' } as const

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  NextResponse.json(body, { status, headers: { ...CORS, ...headers } })

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS })
}

function clientIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for')
  return (forwarded?.split(',')[0] ?? request.headers.get('x-real-ip') ?? 'unknown').trim()
}

// POST /api/public/enquiries
//   { workspaceId, firstName?, lastName?, email?, phone?, message?,
//     propertyReference? | propertyId?, website? }
// `website` is the honeypot: a field no human sees, so anything in it is a bot.
export async function POST(request: NextRequest) {
  try {
    const declared = Number(request.headers.get('content-length') ?? 0)
    if (declared > MAX_BODY_BYTES) return json({ error: 'Request too large' }, 413)

    const raw = await request.text()
    if (raw.length > MAX_BODY_BYTES) return json({ error: 'Request too large' }, 413)

    let body: Record<string, unknown>
    try {
      const parsed = JSON.parse(raw)
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('not an object')
      body = parsed as Record<string, unknown>
    } catch {
      return json({ error: 'Invalid request body' }, 400)
    }

    // A listing page posts with the listing's token and nothing else to identify it:
    // the workspace and the property come from the token, never from the client, so a
    // visitor cannot aim an enquiry at some other agency's property.
    let workspaceId = typeof body.workspaceId === 'string' ? body.workspaceId : ''
    let propertyId = typeof body.propertyId === 'string' ? body.propertyId : undefined
    if (typeof body.listingToken === 'string' && body.listingToken) {
      const listed = await prisma.property.findFirst({
        where: { publicToken: body.listingToken, isPublished: true },
        select: { id: true, workspaceId: true },
      })
      if (!listed) return json({ error: 'Invalid request' }, 400)
      workspaceId = listed.workspaceId
      propertyId = listed.id
    }
    if (!workspaceId) return json({ error: 'workspaceId is required' }, 400)

    // Limited before the database is touched, and both budgets are spent together
    // or not at all, so one noisy address cannot drain the workspace's allowance.
    const limit = await consumeRateLimits([
      { subject: `ip:${clientIp(request)}`, rule: PER_IP },
      { subject: `workspace:${workspaceId}`, rule: PER_WORKSPACE },
    ])
    if (!limit.allowed) return rateLimitedResponse(limit, 1, { noun: 'enquiry', verb: 'send' })

    // A bot filled in the field a person cannot see. Say it worked: telling it
    // otherwise teaches it to stop filling that field in.
    if (typeof body.website === 'string' && body.website.trim() !== '') return json({ ok: true })

    await receiveEnquiry({
      workspaceId,
      channel: 'website',
      firstName: body.firstName as string,
      lastName: body.lastName as string,
      email: body.email as string,
      phone: body.phone as string,
      message: body.message as string,
      propertyId,
      propertyReference: propertyId ? undefined : (body.propertyReference as string),
    })

    // Deliberately nothing about the lead: not its id, not whether the address was
    // already known. A public endpoint must not be a way to probe a contact list.
    return json({ ok: true })
  } catch (error) {
    if (error instanceof ServiceError) {
      // An unknown workspace looks like any other bad input.
      return json({ error: error.status === 404 ? 'Invalid request' : error.message }, error.status === 404 ? 400 : error.status)
    }
    console.error('Error receiving enquiry:', error)
    return json({ error: 'Failed to send your enquiry' }, 500)
  }
}
