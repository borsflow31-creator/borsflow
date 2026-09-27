import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { emailSegmentationService } from '@/lib/email-segmentation'
import { requireWorkspaceAccess, requireWorkspacePermission } from '@/lib/api/workspace'

/** Authorizes against the workspace that owns the segment; `write` also needs content permission. */
async function authorize(id: string, write: boolean) {
  const segment = await prisma.segmentationRule.findUnique({
    where: { id },
    select: { workspaceId: true },
  })
  if (!segment) return { error: 'Segment not found', status: 404 as const }

  return write
    ? requireWorkspacePermission(segment.workspaceId, 'content:create')
    : requireWorkspaceAccess(segment.workspaceId)
}

/** Same rule as the create route: an array (or JSON string of one) of { field, operator }. */
function parseCriteria(input: unknown): any[] | null {
  let value = input
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value)
    } catch {
      return null
    }
  }
  const valid =
    Array.isArray(value) &&
    value.length > 0 &&
    value.every(
      (c) => c && typeof c === 'object' && typeof (c as any).field === 'string' && typeof (c as any).operator === 'string'
    )
  return valid ? (value as any[]) : null
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

    const segment = await prisma.segmentationRule.findUnique({
      where: { id: params.id }
    })
    return NextResponse.json({ segment })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch segment' }, { status: 500 })
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
    const { name, description, criteria, logicOperator, isActive, tags } = body

    const data: Record<string, any> = {}
    if (name !== undefined) data.name = name
    if (description !== undefined) data.description = description
    if (criteria !== undefined) {
      const parsed = parseCriteria(criteria)
      if (!parsed) {
        return NextResponse.json(
          { error: 'Criteria must be a list of conditions, each with a field and an operator' },
          { status: 400 }
        )
      }
      data.criteria = JSON.stringify(parsed)
    }
    if (logicOperator !== undefined) data.logicOperator = logicOperator === 'OR' ? 'OR' : 'AND'
    if (isActive !== undefined) data.isActive = isActive
    if (tags !== undefined) data.tags = Array.isArray(tags) ? JSON.stringify(tags) : tags

    await prisma.segmentationRule.update({
      where: { id: params.id },
      data
    })

    // Membership is materialized, so a changed rule must be re-evaluated or
    // campaigns keep targeting the members of the old rule.
    if (data.criteria !== undefined || data.logicOperator !== undefined) {
      await emailSegmentationService.calculateSegmentSize(params.id)
    }

    const segment = await prisma.segmentationRule.findUnique({ where: { id: params.id } })
    return NextResponse.json({ segment })
  } catch (error: any) {
    console.error('Error updating segment:', error)
    return NextResponse.json({ error: 'Failed to update segment' }, { status: 500 })
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

    await prisma.segmentationRule.delete({
      where: { id: params.id }
    })
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete segment' }, { status: 500 })
  }
}
