import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  AI_RATE_LIMIT_ACTION,
  aiLimitTargets,
  consumeRateLimits,
  rateLimitedResponse,
} from '@/lib/api/rate-limit'
import { consumeUsage, currentPeriod, getUsage, recordUsage, releaseUsage, usageLimitResponse } from './entitlements'
import { creditsFor, type TokenUsage } from './ai-pricing'

/**
 * AI credit billing: reserve before the call, settle on what it really used.
 *
 *   1. `reserveAiCredits` takes an estimate up front through the atomic
 *      `consumeUsage`, so a workspace with no credits left is refused before any
 *      model spend, and two concurrent requests can't both take the last credits.
 *   2. `settleAiCredits` prices the tokens Groq reported and adjusts the counter
 *      by the difference, in the month the reservation was taken, and writes one
 *      `AiUsageEvent` row.
 *
 * A call that produced tokens is charged for them even if the caller then
 * rejects the output (bad JSON, empty list): the model spend happened. Only a
 * call that produced nothing is refunded in full.
 */

export type AiFeature = 'agent' | 'complete' | 'template' | 'product' | 'email_template'

export type AiCallStatus = 'ok' | 'error' | 'aborted'

export interface AiReservation {
  workspaceId: string
  userId: string
  feature: AiFeature
  model: string
  /** The UsageCounter period the reservation was taken from. */
  period: string
  reserved: number
  settled: boolean
}

export type AiReserveResult =
  | { ok: true; reservation: AiReservation }
  | { ok: false; response: NextResponse }

/**
 * Rate-limit the request and reserve credits for `estimate` tokens on `model`.
 * `workspaceId` must already be access-checked by the caller: it is the pool
 * that pays, so it must be the workspace the user is working in.
 */
export async function reserveAiCredits(params: {
  userId: string
  workspaceId: string
  feature: AiFeature
  model: string
  estimate: TokenUsage
}): Promise<AiReserveResult> {
  const { userId, workspaceId, feature, model, estimate } = params

  const limit = await consumeRateLimits(aiLimitTargets(userId, workspaceId))
  if (!limit.allowed) {
    return { ok: false, response: rateLimitedResponse(limit, 1, AI_RATE_LIMIT_ACTION) }
  }

  const period = currentPeriod()
  const reserved = creditsFor(model, estimate)
  const result = await consumeUsage(workspaceId, 'ai_credits', reserved)
  if (!result.allowed) {
    return { ok: false, response: usageLimitResponse('ai_credits', result) }
  }

  return {
    ok: true,
    reservation: { workspaceId, userId, feature, model, period, reserved, settled: false },
  }
}

/**
 * Settle a reservation on the tokens actually used and return the credits
 * charged. `usage` of null or zero tokens means nothing was generated: full
 * refund. Safe to call twice; the second call is a no-op.
 */
export async function settleAiCredits(
  reservation: AiReservation,
  usage: TokenUsage | null,
  status: AiCallStatus
): Promise<number> {
  if (reservation.settled) return 0
  reservation.settled = true

  const producedTokens = !!usage && usage.inputTokens + usage.outputTokens > 0
  const actual = producedTokens ? creditsFor(reservation.model, usage!) : 0
  const diff = actual - reservation.reserved

  try {
    if (diff > 0) {
      // Over the estimate: charged even past the limit, because the spend already
      // happened. The next request will be refused if the pool is now empty.
      await recordUsage(reservation.workspaceId, 'ai_credits', diff, reservation.period)
    } else if (diff < 0) {
      await releaseUsage(reservation.workspaceId, 'ai_credits', -diff, reservation.period)
    }
  } catch (error) {
    // A lost adjustment costs or gives a few credits; it must not mask the answer.
    console.error('Failed to settle AI credits:', error)
  }

  try {
    await prisma.aiUsageEvent.create({
      data: {
        workspaceId: reservation.workspaceId,
        userId: reservation.userId,
        feature: reservation.feature,
        model: reservation.model,
        inputTokens: usage?.inputTokens ?? 0,
        outputTokens: usage?.outputTokens ?? 0,
        credits: actual,
        period: reservation.period,
        status,
      },
    })
  } catch (error) {
    console.error('Failed to record AI usage event:', error)
  }

  return actual
}

/**
 * Whether the pool can pay for another model round, given what this request has
 * used so far (which may already exceed its reservation). The agent checks this
 * between tool rounds so one long question cannot run far past an empty pool.
 */
export async function canAffordAnotherRound(
  reservation: AiReservation,
  usageSoFar: TokenUsage
): Promise<boolean> {
  const usage = await getUsage(reservation.workspaceId, 'ai_credits')
  if (usage.limit === null) return true
  const unrecorded = Math.max(0, creditsFor(reservation.model, usageSoFar) - reservation.reserved)
  return usage.used + unrecorded < usage.limit
}
