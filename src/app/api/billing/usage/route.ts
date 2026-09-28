import { NextRequest, NextResponse } from 'next/server'
import { requireWorkspaceAccess } from '@/lib/api/workspace'
import { getMemberUsage, getUsage, getWorkspacePlan } from '@/lib/billing/entitlements'
import { BILLING_ENABLED, FOUNDING_DISCOUNT_PERCENT } from '@/lib/billing/plans'

/**
 * GET /api/billing/usage?workspaceId=...
 * The workspace's plan and this month's usage, for the Plan & usage settings.
 */
export async function GET(request: NextRequest) {
  const workspaceId = request.nextUrl.searchParams.get('workspaceId')
  if (!workspaceId) {
    return NextResponse.json({ error: 'workspaceId is required' }, { status: 400 })
  }

  const access = await requireWorkspaceAccess(workspaceId)
  if ('error' in access) {
    return NextResponse.json({ error: access.error }, { status: access.status })
  }

  try {
    const [{ plan }, members, aiCredits] = await Promise.all([
      getWorkspacePlan(workspaceId),
      getMemberUsage(workspaceId),
      getUsage(workspaceId, 'ai_credits'),
    ])

    return NextResponse.json({
      plan: { tier: plan.tier, name: plan.name, limits: plan.limits },
      members,
      aiCredits: { used: aiCredits.used, limit: aiCredits.limit },
      billingEnabled: BILLING_ENABLED,
      foundingDiscountPercent: FOUNDING_DISCOUNT_PERCENT,
    })
  } catch (error) {
    console.error('Error loading billing usage:', error)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
