import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * Sliding-window rate limiting backed by Postgres.
 *
 * Postgres because it is the only store shared between serverless instances:
 * there is no Redis/KV in this project, and an in-memory counter would reset
 * with every lambda and silently limit nothing (email-queue.ts's concurrency cap
 * has exactly that problem).
 *
 * Every limited action writes one `RateLimitEvent` row. A rule counts the rows
 * inside its window, so `cost` lets one bulk request use up N units at once -
 * otherwise a bulk endpoint would be a trivial way around a per-invitation limit.
 *
 * This is deliberately NOT atomic: two concurrent requests can both read
 * "1 slot left" and both proceed, overshooting by a small margin. That is fine
 * for an abuse brake; a billing-grade counter would need row locks and cost more
 * than the overshoot is worth.
 */

export interface RateLimitRule {
  /** What is being limited, e.g. 'invitation:send'. */
  bucket: string
  /** Maximum total cost inside the window. */
  limit: number
  windowMs: number
  /** Human name for the window, used in messages: 'hour', 'day'. */
  windowLabel: string
}

export interface RateLimitTarget {
  /** Who the usage is counted against, e.g. 'user:<id>' or 'workspace:<id>'. */
  subject: string
  rule: RateLimitRule
}

export interface RateLimitResult {
  allowed: boolean
  limit: number
  /** Units left in the window before this request's cost is applied. */
  remaining: number
  /** Seconds until capacity starts to free up; 0 when allowed. */
  retryAfterSeconds: number
  resetAt: Date
  windowLabel: string
  /** True when the request alone is larger than the limit, so waiting cannot help. */
  exceedsLimit: boolean
}

/** Invitations: a brake on abuse per user, and on sender reputation per workspace. */
export const INVITATION_RATE_LIMITS = {
  perUser: {
    bucket: 'invitation:send',
    limit: 50,
    windowMs: 60 * 60 * 1000,
    windowLabel: 'hour',
  },
  perWorkspace: {
    bucket: 'invitation:send',
    limit: 200,
    windowMs: 24 * 60 * 60 * 1000,
    windowLabel: 'day',
  },
} satisfies Record<string, RateLimitRule>

export function invitationLimitTargets(userId: string, workspaceId: string): RateLimitTarget[] {
  return [
    { subject: `user:${userId}`, rule: INVITATION_RATE_LIMITS.perUser },
    { subject: `workspace:${workspaceId}`, rule: INVITATION_RATE_LIMITS.perWorkspace },
  ]
}

/** Read-only: would `cost` more units fit inside this rule right now? */
export async function checkRateLimit(
  target: RateLimitTarget,
  cost = 1
): Promise<RateLimitResult> {
  const { subject, rule } = target
  const now = Date.now()
  const windowStart = new Date(now - rule.windowMs)
  const inWindow = { bucket: rule.bucket, subject, createdAt: { gt: windowStart } }

  const [usage, oldest] = await Promise.all([
    prisma.rateLimitEvent.aggregate({ where: inWindow, _sum: { cost: true } }),
    prisma.rateLimitEvent.findFirst({
      where: inWindow,
      orderBy: { createdAt: 'asc' },
      select: { createdAt: true },
    }),
  ])

  const used = usage._sum.cost ?? 0
  const remaining = Math.max(0, rule.limit - used)
  const allowed = used + cost <= rule.limit

  // The oldest event leaving the window is the earliest moment capacity frees.
  const resetAt = oldest
    ? new Date(oldest.createdAt.getTime() + rule.windowMs)
    : new Date(now + rule.windowMs)

  return {
    allowed,
    limit: rule.limit,
    remaining,
    retryAfterSeconds: allowed ? 0 : Math.max(1, Math.ceil((resetAt.getTime() - now) / 1000)),
    resetAt,
    windowLabel: rule.windowLabel,
    exceedsLimit: cost > rule.limit,
  }
}

/**
 * Check every target and, only if ALL have room, record the usage against each.
 *
 * All-or-nothing matters: if the per-user check passed but the per-workspace one
 * failed, charging the user anyway would burn their budget on a request that
 * never went through. When one is denied, the most restrictive denial (longest
 * wait) is returned so the client sees the limit that actually blocks it.
 */
export async function consumeRateLimits(
  targets: RateLimitTarget[],
  cost = 1
): Promise<RateLimitResult> {
  const results = await Promise.all(targets.map(target => checkRateLimit(target, cost)))

  const denied = results.filter(result => !result.allowed)
  if (denied.length > 0) {
    // A request that can never fit takes priority (waiting will not help);
    // otherwise report whichever limit will take longest to clear.
    return (
      denied.find(result => result.exceedsLimit) ??
      denied.reduce((a, b) => (b.retryAfterSeconds > a.retryAfterSeconds ? b : a))
    )
  }

  await prisma.rateLimitEvent.createMany({
    data: targets.map(({ subject, rule }) => ({ bucket: rule.bucket, subject, cost })),
  })

  // Report the tightest limit, with this request already counted against it.
  const tightest = results.reduce((a, b) => (b.remaining < a.remaining ? b : a))
  return { ...tightest, remaining: Math.max(0, tightest.remaining - cost) }
}

/** Delete events too old to matter to any window. Returns how many were removed. */
export async function pruneRateLimitEvents(olderThanMs: number): Promise<number> {
  const result = await prisma.rateLimitEvent.deleteMany({
    where: { createdAt: { lt: new Date(Date.now() - olderThanMs) } },
  })
  return result.count
}

export function rateLimitHeaders(result: RateLimitResult): Record<string, string> {
  const headers: Record<string, string> = {
    'X-RateLimit-Limit': String(result.limit),
    'X-RateLimit-Remaining': String(result.remaining),
    'X-RateLimit-Reset': String(Math.ceil(result.resetAt.getTime() / 1000)),
  }
  if (!result.allowed && !result.exceedsLimit) {
    headers['Retry-After'] = String(result.retryAfterSeconds)
  }
  return headers
}

function describeWait(seconds: number): string {
  if (seconds < 90) return 'about a minute'
  const minutes = Math.round(seconds / 60)
  if (minutes < 90) return `about ${minutes} minutes`
  const hours = Math.round(seconds / 3600)
  return `about ${hours} hour${hours === 1 ? '' : 's'}`
}

/**
 * The 429 for a denied result. The body is `{ error }` like every other route,
 * so existing client error handling shows it without changes.
 */
export function rateLimitedResponse(result: RateLimitResult, cost: number): NextResponse {
  let error: string

  if (result.exceedsLimit) {
    // Waiting will not help: the request is bigger than the whole allowance.
    error = `You can send at most ${result.limit} invitations per ${result.windowLabel}. This request has ${cost}; send fewer at a time.`
  } else {
    error = `You've reached the invitation limit (${result.limit} per ${result.windowLabel}). Try again in ${describeWait(result.retryAfterSeconds)}.`
    if (result.remaining > 0) {
      error += ` You can send ${result.remaining} more right now.`
    }
  }

  return NextResponse.json(
    {
      error,
      remaining: result.remaining,
      retryAfterSeconds: result.exceedsLimit ? null : result.retryAfterSeconds,
    },
    { status: 429, headers: rateLimitHeaders(result) }
  )
}
