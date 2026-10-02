import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireWorkspaceAccess, requireWorkspacePermission } from '@/lib/api/workspace'
import { normalizeSteps, normalizeTriggers } from '@/lib/email/automation-validation'

async function loadAutomation(id: string) {
  return prisma.emailAutomation.findUnique({
    where: { id },
    include: {
      triggers: true,
      steps: {
        orderBy: { order: 'asc' },
        include: { template: { select: { id: true, name: true } } },
      },
      _count: { select: { enrollments: true } },
    },
  })
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const automation = await loadAutomation(params.id)
    if (!automation) {
      return NextResponse.json({ error: 'Automation not found' }, { status: 404 })
    }

    const access = await requireWorkspaceAccess(automation.workspaceId)
    if ('error' in access) {
      return NextResponse.json({ error: access.error }, { status: access.status })
    }

    return NextResponse.json({ automation })
  } catch (error) {
    console.error('Error fetching automation:', error)
    return NextResponse.json({ error: 'Failed to fetch automation' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const automation = await prisma.emailAutomation.findUnique({
      where: { id: params.id },
      select: { id: true, workspaceId: true, status: true },
    })

    if (!automation) {
      return NextResponse.json({ error: 'Automation not found' }, { status: 404 })
    }

    const access = await requireWorkspacePermission(automation.workspaceId, 'content:create')
    if ('error' in access) {
      return NextResponse.json({ error: access.error }, { status: access.status })
    }

    const body = await request.json()
    const { name, description, type, triggers, steps, exitCriteria } = body

    // Steps are addressed by position, so reordering them under a running
    // automation would move live enrollments to the wrong message.
    if (steps !== undefined && automation.status === 'active') {
      return NextResponse.json(
        { error: 'Pause the automation before editing its steps' },
        { status: 400 }
      )
    }

    const normalizedTriggers = triggers !== undefined ? normalizeTriggers(triggers) : null
    if (normalizedTriggers && 'error' in normalizedTriggers) {
      return NextResponse.json({ error: normalizedTriggers.error }, { status: 400 })
    }

    const normalizedSteps = steps !== undefined
      ? await normalizeSteps(steps, automation.workspaceId)
      : null
    if (normalizedSteps && 'error' in normalizedSteps) {
      return NextResponse.json({ error: normalizedSteps.error }, { status: 400 })
    }

    await prisma.$transaction(async (tx) => {
      if (normalizedTriggers) {
        await tx.automationTrigger.deleteMany({ where: { automationId: params.id } })
        for (const trigger of normalizedTriggers.value) {
          await tx.automationTrigger.create({
            data: { ...trigger, automationId: params.id },
          })
        }
      }

      if (normalizedSteps) {
        await tx.automationStep.deleteMany({ where: { automationId: params.id } })
        for (const step of normalizedSteps.value) {
          await tx.automationStep.create({
            data: { ...step, automationId: params.id },
          })
        }
      }

      await tx.emailAutomation.update({
        where: { id: params.id },
        data: {
          ...(name !== undefined && { name }),
          ...(description !== undefined && { description }),
          ...(type !== undefined && { type }),
          ...(exitCriteria !== undefined && {
            exitCriteria: Array.isArray(exitCriteria) && exitCriteria.length > 0
              ? JSON.stringify(exitCriteria)
              : null,
          }),
          updatedBy: access.session.user.id,
        },
      })
    })

    return NextResponse.json({ automation: await loadAutomation(params.id) })
  } catch (error) {
    console.error('Error updating automation:', error)
    return NextResponse.json({ error: 'Failed to update automation' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const automation = await prisma.emailAutomation.findUnique({
      where: { id: params.id },
      select: { id: true, workspaceId: true },
    })

    if (!automation) {
      return NextResponse.json({ error: 'Automation not found' }, { status: 404 })
    }

    const access = await requireWorkspacePermission(automation.workspaceId, 'content:create')
    if ('error' in access) {
      return NextResponse.json({ error: access.error }, { status: access.status })
    }

    // Cancel anything this automation still has waiting in the queue, or those
    // emails would go out after the automation is gone.
    const pending = await prisma.emailQueue.findMany({
      where: {
        status: 'pending',
        email: { automationEnrollment: { automationId: params.id } },
      },
      select: { id: true },
    })

    if (pending.length > 0) {
      await prisma.emailQueue.updateMany({
        where: { id: { in: pending.map(p => p.id) } },
        data: { status: 'cancelled' },
      })
    }

    // Triggers, steps and enrollments cascade at the DB level.
    await prisma.emailAutomation.delete({ where: { id: params.id } })

    return NextResponse.json({ message: 'Automation deleted successfully' })
  } catch (error) {
    console.error('Error deleting automation:', error)
    return NextResponse.json({ error: 'Failed to delete automation' }, { status: 500 })
  }
}
