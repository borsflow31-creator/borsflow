/**
 * Email Marketing Campaigns API
 *
 * RESTful API endpoints for managing email campaigns
 */

import { NextRequest, NextResponse } from 'next/server'
import { emailCampaignService } from '@/lib/email-campaign'
import { requireWorkspaceAccess, requireWorkspacePermission } from '@/lib/api/workspace'
import { checkCampaignRefs } from '@/lib/email/campaign-refs'

// GET /api/email-marketing/campaigns - Get all campaigns for workspace
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const workspaceId = searchParams.get('workspaceId')
    const status = searchParams.get('status')
    const type = searchParams.get('type')
    const limit = searchParams.get('limit')
    const offset = searchParams.get('offset')

    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace ID is required' }, { status: 400 })
    }

    const access = await requireWorkspaceAccess(workspaceId)
    if ('error' in access) {
      return NextResponse.json({ error: access.error }, { status: access.status })
    }

    const campaigns = await emailCampaignService.getCampaigns(workspaceId, {
      status: status || undefined,
      type: type || undefined,
      limit: limit ? parseInt(limit) : undefined,
      offset: offset ? parseInt(offset) : undefined
    })

    return NextResponse.json({ campaigns })
  } catch (error) {
    console.error('Error fetching campaigns:', error)
    return NextResponse.json({ error: 'Failed to fetch campaigns' }, { status: 500 })
  }
}

// POST /api/email-marketing/campaigns - Create a new campaign
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    const { workspaceId, name, description, type, templateId, subject, fromName, fromEmail, replyTo, segmentationRuleId, scheduledAt, tags, metadata } = body

    if (!workspaceId || !name || !subject) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const access = await requireWorkspacePermission(workspaceId, 'content:create')
    if ('error' in access) {
      return NextResponse.json({ error: access.error }, { status: access.status })
    }

    const refError = await checkCampaignRefs(workspaceId, { templateId, segmentationRuleId })
    if (refError) {
      return NextResponse.json({ error: refError }, { status: 400 })
    }

    const campaign = await emailCampaignService.createCampaign({
      name,
      description,
      type: type || 'broadcast',
      workspaceId,
      templateId,
      subject,
      fromName,
      fromEmail,
      replyTo,
      segmentationRuleId,
      scheduledAt: scheduledAt ? new Date(scheduledAt) : undefined,
      tags,
      metadata,
      createdById: access.session.user.id
    })

    return NextResponse.json({ campaign }, { status: 201 })
  } catch (error) {
    console.error('Error creating campaign:', error)
    return NextResponse.json({ error: 'Failed to create campaign' }, { status: 500 })
  }
}
