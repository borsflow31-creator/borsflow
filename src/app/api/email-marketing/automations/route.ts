/**
 * Email Marketing Automations API
 *
 * Automations connect a CRM pipeline stage change to a sequence of templates.
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireWorkspaceAccess, requireWorkspacePermission } from '@/lib/api/workspace'
import { normalizeSteps, normalizeTriggers } from '@/lib/email/automation-validation'

// GET /api/email-marketing/automations?workspaceId=
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const workspaceId = searchParams.get('workspaceId')

    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace ID is required' }, { status: 400 })
    }

    const access = await requireWorkspaceAccess(workspaceId)
    if ('error' in access) {
      return NextResponse.json({ error: access.error }, { status: access.status })
    }

    const automations = await prisma.emailAutomation.findMany({
      where: { workspaceId },
      include: {
        triggers: true,
        steps: {
          orderBy: { order: 'asc' },
          include: { template: { select: { id: true, name: true } } },
        },
        _count: { select: { enrollments: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ automations })
  } catch (error) {
    console.error('Error fetching automations:', error)
    return NextResponse.json({ error: 'Failed to fetch automations' }, { status: 500 })
  }
}

// POST /api/email-marketing/automations
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { workspaceId, name, description, type, triggers, steps } = body

    if (!workspaceId || !name) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const access = await requireWorkspacePermission(workspaceId, 'content:create')
    if ('error' in access) {
      return NextResponse.json({ error: access.error }, { status: access.status })
    }

    const normalizedTriggers = normalizeTriggers(triggers)
    if ('error' in normalizedTriggers) {
      return NextResponse.json({ error: normalizedTriggers.error }, { status: 400 })
    }

    const normalizedSteps = await normalizeSteps(steps, workspaceId)
    if ('error' in normalizedSteps) {
      return NextResponse.json({ error: normalizedSteps.error }, { status: 400 })
    }

    const automation = await prisma.emailAutomation.create({
      data: {
        workspaceId,
        name,
        description: description || null,
        type: type || 'trigger',
        status: 'draft',
        createdById: access.session.user.id,
        triggers: { create: normalizedTriggers.value },
        steps: { create: normalizedSteps.value },
      },
      include: {
        triggers: true,
        steps: { orderBy: { order: 'asc' } },
      },
    })

    return NextResponse.json({ automation }, { status: 201 })
  } catch (error) {
    console.error('Error creating automation:', error)
    return NextResponse.json({ error: 'Failed to create automation' }, { status: 500 })
  }
}
