import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { consumeUsage, recordUsage, releaseUsage, usageLimitResponse } from './entitlements'

/**
 * What each AI action costs. Roughly proportional to Groq spend: the 70B model
 * costs about 5x the 8B one per call.
 */
export const AI_CREDIT_COSTS = {
  chat: 1, // llama-3.1-8b-instant
  chatToolCall: 1, // added on top of `chat` when the assistant actually used tools
  templateGenerate: 3,
  productSuggest: 5, // llama-3.3-70b-versatile
  emailTemplate: 5, // llama-3.3-70b-versatile
} as const

/**
 * The workspace whose pool pays for a request. Several editor features call the
 * AI without saying which workspace they are in, so fall back to the caller's
 * own workspace (oldest first), then one they are a member of.
 */
async function resolveBillingWorkspace(
  userId: string,
  workspaceId?: string | null
): Promise<string | null> {
  if (workspaceId) return workspaceId

  const owned = await prisma.workspace.findFirst({
    where: { ownerId: userId },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  })
  if (owned) return owned.id

  const membership = await prisma.workspaceMember.findFirst({
    where: { userId },
    orderBy: { createdAt: 'asc' },
    select: { workspaceId: true },
  })
  return membership?.workspaceId ?? null
}

export type AiCharge =
  | { ok: true; workspaceId: string; cost: number }
  | { ok: false; response: NextResponse }

/**
 * Take `cost` credits before calling the model. `workspaceId` must already be
 * access-checked by the caller when given.
 */
export async function chargeAiCredits(
  userId: string,
  workspaceId: string | null | undefined,
  cost: number
): Promise<AiCharge> {
  const billingWorkspaceId = await resolveBillingWorkspace(userId, workspaceId)
  if (!billingWorkspaceId) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Create or join a workspace to use the AI assistant.' },
        { status: 403 }
      ),
    }
  }

  const result = await consumeUsage(billingWorkspaceId, 'ai_credits', cost)
  if (!result.allowed) {
    return { ok: false, response: usageLimitResponse('ai_credits', result) }
  }
  return { ok: true, workspaceId: billingWorkspaceId, cost }
}

/** Refund a charge whose model call failed before producing anything. */
export async function refundAiCredits(charge: { workspaceId: string; cost: number }) {
  try {
    await releaseUsage(charge.workspaceId, 'ai_credits', charge.cost)
  } catch (error) {
    // A lost refund costs the user a few credits; it must not mask the real error.
    console.error('Failed to refund AI credits:', error)
  }
}

export async function addAiCredits(workspaceId: string, cost: number) {
  try {
    await recordUsage(workspaceId, 'ai_credits', cost)
  } catch (error) {
    console.error('Failed to record AI credits:', error)
  }
}
