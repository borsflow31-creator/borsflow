/**
 * Flip an automation between draft / active / paused.
 *
 * Activation is the gate where a misconfigured automation gets caught — once
 * active it runs unattended against every stage change in the workspace.
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireWorkspacePermission } from '@/lib/api/workspace'

const ALLOWED_STATUSES = ['active', 'paused', 'draft']

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const automation = await prisma.emailAutomation.findUnique({
      where: { id: params.id },
      include: {
        triggers: true,
        steps: { orderBy: { order: 'asc' } },
      },
    })

    if (!automation) {
      return NextResponse.json({ error: 'Automation not found' }, { status: 404 })
    }

    const access = await requireWorkspacePermission(automation.workspaceId, 'content:create')
    if ('error' in access) {
      return NextResponse.json({ error: access.error }, { status: access.status })
    }

    const body = await request.json().catch(() => ({}))
    const status = body?.status || 'active'

    if (!ALLOWED_STATUSES.includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }

    if (status === 'active') {
      const problem = await validateForActivation(automation)
      if (problem) {
        return NextResponse.json({ error: problem }, { status: 400 })
      }
    }

    const updated = await prisma.emailAutomation.update({
      where: { id: params.id },
      data: { status, updatedBy: access.session.user.id },
    })

    return NextResponse.json({ automation: updated })
  } catch (error) {
    console.error('Error changing automation status:', error)
    return NextResponse.json({ error: 'Failed to change automation status' }, { status: 500 })
  }
}

/** Returns a user-facing message when the automation can't safely run, else null. */
async function validateForActivation(automation: any): Promise<string | null> {
  if (automation.triggers.length === 0) {
    return 'Add a trigger before activating'
  }

  if (automation.steps.length === 0) {
    return 'Add at least one step before activating'
  }

  const stepWithoutTemplate = automation.steps.find((s: any) => !s.templateId)
  if (stepWithoutTemplate) {
    return `Step "${stepWithoutTemplate.name}" needs a template`
  }

  // A stage can be renamed or deleted after the trigger was saved. Catch that
  // here rather than letting the automation silently never fire.
  for (const trigger of automation.triggers) {
    let conditions: any
    try {
      conditions = JSON.parse(trigger.conditions)
    } catch {
      return 'A trigger has invalid conditions'
    }

    if (!conditions?.toStage) {
      return 'A trigger is missing the stage to enter'
    }

    if (!conditions.pipelineId) continue

    const pipeline = await prisma.pipeline.findFirst({
      where: { id: conditions.pipelineId, workspaceId: automation.workspaceId },
      select: { name: true, stages: true },
    })

    if (!pipeline) {
      return 'A trigger points at a pipeline that no longer exists'
    }

    let stages: string[] = []
    try {
      const parsed = JSON.parse(pipeline.stages)
      if (Array.isArray(parsed)) stages = parsed
    } catch {
      stages = []
    }

    if (!stages.includes(conditions.toStage)) {
      return `"${conditions.toStage}" is no longer a stage in ${pipeline.name}`
    }
  }

  return null
}
