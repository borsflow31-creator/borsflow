import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { isValidEmail } from '@/lib/email'
import { normalizeEmail } from '@/lib/email/normalize'
import { consumeRateLimits, rateLimitHeaders } from '@/lib/api/rate-limit'
import { FOUNDING_DISCOUNT_PERCENT, WAITLIST_TIERS, isPlanTier } from '@/lib/billing/plans'

// Public: visitors on the pricing page are usually signed out.
const WAITLIST_RATE_LIMIT = {
  bucket: 'billing:waitlist',
  limit: 10,
  windowMs: 60 * 60 * 1000,
  windowLabel: 'hour',
}

/**
 * POST /api/billing/waitlist
 * Body: { email?: string, tier: 'STARTER' | 'PRO' | 'BUSINESS', workspaceId?: string }
 *
 * "Notify me" for a paid plan while only Free is available. Signing up twice
 * for the same tier is a no-op, not an error.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const body = await request.json().catch(() => null)

    const tier = body?.tier
    if (!isPlanTier(tier) || !WAITLIST_TIERS.includes(tier)) {
      return NextResponse.json({ error: 'Choose a paid plan to join its waitlist' }, { status: 400 })
    }

    // A signed-in user joins with their account email; the form field is for visitors.
    const email = normalizeEmail(session?.user?.email ?? body?.email)
    if (!email || !isValidEmail(email)) {
      return NextResponse.json({ error: 'Valid email is required' }, { status: 400 })
    }

    const ip = request.ip || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    const subject = session?.user?.id ? `user:${session.user.id}` : `ip:${ip ?? 'unknown'}`
    const limit = await consumeRateLimits([{ subject, rule: WAITLIST_RATE_LIMIT }], 1)
    if (!limit.allowed) {
      return NextResponse.json(
        { error: 'Too many sign-ups from here. Try again later.' },
        { status: 429, headers: rateLimitHeaders(limit) }
      )
    }

    // Only record a workspace the caller actually belongs to.
    let workspaceId: string | null = null
    if (session?.user?.id && typeof body?.workspaceId === 'string') {
      const workspace = await prisma.workspace.findFirst({
        where: {
          id: body.workspaceId,
          OR: [
            { ownerId: session.user.id },
            { members: { some: { userId: session.user.id } } },
          ],
        },
        select: { id: true },
      })
      workspaceId = workspace?.id ?? null
    }

    await prisma.planWaitlist.upsert({
      where: { email_tier: { email, tier } },
      create: { email, tier, userId: session?.user?.id ?? null, workspaceId },
      update: {},
    })

    return NextResponse.json(
      { joined: true, tier, foundingDiscountPercent: FOUNDING_DISCOUNT_PERCENT },
      { status: 201 }
    )
  } catch (error) {
    console.error('Error joining plan waitlist:', error)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
