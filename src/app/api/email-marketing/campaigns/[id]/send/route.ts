import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { emailCampaignService } from '@/lib/email-campaign'
import { requireWorkspacePermission } from '@/lib/api/workspace'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const campaign = await emailCampaignService.getCampaign(params.id)
    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }

    // Sending mails the workspace's whole list, so it needs membership in the
    // campaign's own workspace and permission to change content.
    const access = await requireWorkspacePermission(campaign.workspaceId, 'content:create')
    if ('error' in access) {
      return NextResponse.json({ error: access.error }, { status: access.status })
    }

    if (campaign.status !== 'draft' && campaign.status !== 'scheduled') {
      return NextResponse.json({ error: 'Campaign must be in draft or scheduled status' }, { status: 400 })
    }

    const blocker = await emailCampaignService.getSendBlocker(campaign)
    if (blocker) {
      return NextResponse.json({ error: blocker }, { status: 400 })
    }

    // Idempotency: atomically flip status to 'sending' — only one request wins
    const updated = await prisma.emailCampaign.updateMany({
      where: { id: params.id, status: { in: ['draft', 'scheduled'] } },
      data: { status: 'sending' }
    })

    if (updated.count === 0) {
      return NextResponse.json({ error: 'Campaign is already being sent or was already executed' }, { status: 409 })
    }

    // Queue one email per recipient; the email-queue cron sends them through the
    // workspace's active provider.
    await emailCampaignService.executeCampaign(params.id)

    return NextResponse.json({ success: true, message: 'Campaign execution started' })
  } catch (error: any) {
    console.error('Error sending campaign:', error)
    return NextResponse.json({ error: 'Failed to execute campaign' }, { status: 500 })
  }
}
