import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { emailCampaignService } from '@/lib/email-campaign'
import { requireWorkspaceAccess, requireWorkspacePermission } from '@/lib/api/workspace'
import { checkCampaignRefs } from '@/lib/email/campaign-refs'

/** Authorizes against the workspace that owns the campaign; `write` also needs content permission. */
async function authorize(id: string, write: boolean) {
  const campaign = await prisma.emailCampaign.findUnique({
    where: { id },
    select: { workspaceId: true },
  })
  if (!campaign) return { error: 'Campaign not found', status: 404 as const }

  return write
    ? requireWorkspacePermission(campaign.workspaceId, 'content:create')
    : requireWorkspaceAccess(campaign.workspaceId)
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const access = await authorize(params.id, false)
    if ('error' in access) {
      return NextResponse.json({ error: access.error }, { status: access.status })
    }

    const campaign = await emailCampaignService.getCampaign(params.id)
    return NextResponse.json({ campaign })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch campaign' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const access = await authorize(params.id, true)
    if ('error' in access) {
      return NextResponse.json({ error: access.error }, { status: access.status })
    }

    const body = await request.json()

    // A campaign's template and segment must stay inside its own workspace.
    const refError = await checkCampaignRefs(access.workspace.id, {
      templateId: body.templateId,
      segmentationRuleId: body.segmentationRuleId,
    })
    if (refError) {
      return NextResponse.json({ error: refError }, { status: 400 })
    }

    const campaign = await emailCampaignService.updateCampaign(params.id, {
      ...body,
      updatedBy: access.session.user.id
    })
    return NextResponse.json({ campaign })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update campaign' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const access = await authorize(params.id, true)
    if ('error' in access) {
      return NextResponse.json({ error: access.error }, { status: access.status })
    }

    await emailCampaignService.deleteCampaign(params.id)
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete campaign' }, { status: 500 })
  }
}
