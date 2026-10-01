import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import {
  BILLING_ENABLED,
  FOUNDING_DISCOUNT_PERCENT,
  MEMBER_PACK_SIZE,
  PLANS,
  metricLimit,
  type PlanDefinition,
  type UsageMetric,
} from './plans'

/**
 * Server-side plan enforcement.
 *
 * Unlike the abuse brakes in `@/lib/api/rate-limit`, these counters are what a
 * paid plan is measured against, so `consumeUsage` is atomic: the limit check
 * and the increment are one conditional UPDATE, and two concurrent requests
 * cannot both take the last credit.
 */

/** Calendar month in UTC, e.g. '2026-09'. A new month simply gets a new row. */
export function currentPeriod(date = new Date()): string {
  return date.toISOString().slice(0, 7)
}

export interface WorkspacePlan {
  plan: PlanDefinition
  extraMemberPacks: number
}

export async function getWorkspacePlan(workspaceId: string): Promise<WorkspacePlan> {
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { plan: true, extraMemberPacks: true },
  })
  return {
    plan: PLANS[workspace?.plan ?? 'FREE'],
    extraMemberPacks: workspace?.extraMemberPacks ?? 0,
  }
}

// ─── Members ─────────────────────────────────────────────────────────────────

export interface MemberUsage {
  /** Invited members plus live pending invitations; the owner is not counted. */
  used: number
  members: number
  pendingInvitations: number
  /** null = unlimited. */
  capacity: number | null
}

export async function getMemberUsage(workspaceId: string): Promise<MemberUsage> {
  const [{ plan, extraMemberPacks }, members, pendingInvitations] = await Promise.all([
    getWorkspacePlan(workspaceId),
    prisma.workspaceMember.count({ where: { workspaceId } }),
    // An expired invitation stays 'pending' until the cron sweeps it; it can no
    // longer be accepted, so it does not hold a seat.
    prisma.invitation.count({
      where: { workspaceId, status: 'pending', expiresAt: { gt: new Date() } },
    }),
  ])

  const base = plan.limits.maxMembers
  return {
    used: members + pendingInvitations,
    members,
    pendingInvitations,
    capacity: base === null ? null : base + extraMemberPacks * MEMBER_PACK_SIZE,
  }
}

/**
 * The 402 for a workspace that has no room for `adding` more invitations, or
 * null when they fit. Pending invitations count, so a workspace cannot send
 * 50 invites on Free and have them all accepted later.
 */
export async function memberCapacityError(
  workspaceId: string,
  adding: number
): Promise<NextResponse | null> {
  const usage = await getMemberUsage(workspaceId)
  if (usage.capacity === null || usage.used + adding <= usage.capacity) return null

  const left = Math.max(0, usage.capacity - usage.used)
  return planLimitResponse({
    kind: 'members',
    limit: usage.capacity,
    used: usage.used,
    message:
      `Your plan includes ${usage.capacity} members, and ${usage.used} seats are taken ` +
      `(members and pending invitations).` +
      (left > 0 ? ` You can invite ${left} more.` : ''),
  })
}

// ─── Monthly usage counters ──────────────────────────────────────────────────

export interface UsageResult {
  allowed: boolean
  used: number
  /** null = unlimited. */
  limit: number | null
}

export async function getUsage(workspaceId: string, metric: UsageMetric): Promise<UsageResult> {
  const [{ plan }, counter] = await Promise.all([
    getWorkspacePlan(workspaceId),
    prisma.usageCounter.findUnique({
      where: {
        workspaceId_metric_period: { workspaceId, metric, period: currentPeriod() },
      },
      select: { used: true, bonus: true },
    }),
  ])
  const base = metricLimit(plan.limits, metric)
  const used = counter?.used ?? 0
  const limit = base === null ? null : base + (counter?.bonus ?? 0)
  return { allowed: limit === null || used < limit, used, limit }
}

async function ensureCounter(workspaceId: string, metric: UsageMetric, period: string) {
  // ON CONFLICT instead of a Prisma upsert: concurrent upserts race on the
  // unique index and one of them throws.
  await prisma.$executeRaw(Prisma.sql`
    INSERT INTO "UsageCounter" ("id", "workspaceId", "metric", "period", "used", "bonus", "updatedAt")
    VALUES (gen_random_uuid()::text, ${workspaceId}, ${metric}, ${period}, 0, 0, NOW())
    ON CONFLICT ("workspaceId", "metric", "period") DO NOTHING
  `)
}

/**
 * Take `amount` units if they fit in this month's allowance. All-or-nothing:
 * a denied request records nothing.
 */
export async function consumeUsage(
  workspaceId: string,
  metric: UsageMetric,
  amount: number
): Promise<UsageResult> {
  const period = currentPeriod()
  const { plan } = await getWorkspacePlan(workspaceId)
  const base = metricLimit(plan.limits, metric)

  if (base === null) {
    const used = await recordUsage(workspaceId, metric, amount)
    return { allowed: true, used, limit: null }
  }

  await ensureCounter(workspaceId, metric, period)
  const rows = await prisma.$queryRaw<Array<{ used: number; bonus: number }>>(Prisma.sql`
    UPDATE "UsageCounter"
    SET "used" = "used" + ${amount}, "updatedAt" = NOW()
    WHERE "workspaceId" = ${workspaceId} AND "metric" = ${metric} AND "period" = ${period}
      AND "used" + ${amount} <= ${base} + "bonus"
    RETURNING "used", "bonus"
  `)

  if (rows.length > 0) {
    return { allowed: true, used: rows[0].used, limit: base + rows[0].bonus }
  }

  const current = await getUsage(workspaceId, metric)
  return { ...current, allowed: false }
}

/**
 * Add usage without a limit check, e.g. settling a request that turned out to
 * cost more than was reserved. `period` defaults to this month; pass the period
 * the original charge went to so a request spanning midnight settles there.
 */
export async function recordUsage(
  workspaceId: string,
  metric: UsageMetric,
  amount: number,
  period = currentPeriod()
): Promise<number> {
  await ensureCounter(workspaceId, metric, period)
  const rows = await prisma.$queryRaw<Array<{ used: number }>>(Prisma.sql`
    UPDATE "UsageCounter"
    SET "used" = "used" + ${amount}, "updatedAt" = NOW()
    WHERE "workspaceId" = ${workspaceId} AND "metric" = ${metric} AND "period" = ${period}
    RETURNING "used"
  `)
  return rows[0]?.used ?? amount
}

/** Give back units taken for a request that then failed or cost less than reserved. */
export async function releaseUsage(
  workspaceId: string,
  metric: UsageMetric,
  amount: number,
  period = currentPeriod()
): Promise<void> {
  await prisma.$executeRaw(Prisma.sql`
    UPDATE "UsageCounter"
    SET "used" = GREATEST(0, "used" - ${amount}), "updatedAt" = NOW()
    WHERE "workspaceId" = ${workspaceId} AND "metric" = ${metric} AND "period" = ${period}
  `)
}

// ─── Responses ───────────────────────────────────────────────────────────────

export type PlanLimitKind = UsageMetric | 'members'

/** Tells the client how to present a limit: waitlist while paid plans are not live. */
export function upgradeHint() {
  return BILLING_ENABLED
    ? { upgradeUrl: '/pricing', billingEnabled: true }
    : {
        upgradeUrl: '/pricing#waitlist',
        billingEnabled: false,
        foundingDiscountPercent: FOUNDING_DISCOUNT_PERCENT,
      }
}

/**
 * 402 with `code: 'PLAN_LIMIT'`. The body keeps the `{ error }` shape every
 * route uses, so existing error handling still shows the message, and the
 * global limit modal recognises the code.
 */
export function planLimitResponse(args: {
  kind: PlanLimitKind
  limit: number
  used: number
  message: string
}): NextResponse {
  const suffix = BILLING_ENABLED
    ? ' Upgrade your plan to get more.'
    : ` Paid plans are coming soon - join the waitlist to get ${FOUNDING_DISCOUNT_PERCENT}% off for life.`

  return NextResponse.json(
    {
      error: args.message + suffix,
      code: 'PLAN_LIMIT',
      kind: args.kind,
      limit: args.limit,
      used: args.used,
      ...upgradeHint(),
    },
    { status: 402 }
  )
}

export function usageLimitResponse(metric: UsageMetric, result: UsageResult): NextResponse {
  const labels: Record<UsageMetric, string> = {
    ai_credits: 'AI credits',
    email_sends: 'email sends',
    invoices: 'invoices and quotes',
  }
  return planLimitResponse({
    kind: metric,
    limit: result.limit ?? 0,
    used: result.used,
    message: `You've used ${result.used} of your ${result.limit} ${labels[metric]} this month.`,
  })
}
