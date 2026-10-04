import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { emailSegmentationService } from '@/lib/email-segmentation'
import { requireWorkspaceAccess, requireWorkspacePermission } from '@/lib/api/workspace'
import { DEFAULT_SUBJECT_TYPE, isSubjectType, type SubjectType } from '@/lib/crm/subjects'
import { hasLoader } from '@/lib/crm/subject-registry'

// A segment's subject decides which rows its criteria are evaluated against, so
// it can only be one the server knows how to load. An unknown value would make
// the segment silently match nothing.
function parseSubjectType(value: unknown): SubjectType | null {
  if (value === undefined || value === null || value === '') return DEFAULT_SUBJECT_TYPE
  if (!isSubjectType(value) || !hasLoader(value)) return null
  return value
}


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
    if (body.subjectType !== undefined) {
      const subjectType = parseSubjectType(body.subjectType)
      if (!subjectType) {
        return NextResponse.json({ error: 'Unknown segment subject' }, { status: 400 })
      }
      data.subjectType = subjectType
    }
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
    // campaigns keep targeting the members of the old rule. A changed subject
    // matters most: the stored members are rows of the previous type.
    if (data.criteria !== undefined || data.logicOperator !== undefined || data.subjectType !== undefined) {
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

    // Deleting it would clear the link, and a campaign with no segment mails
    // every lead in the workspace. Make the user repoint those campaigns first.
    const pending = await prisma.emailCampaign.findMany({
      where: { segmentationRuleId: params.id, status: { in: ['draft', 'scheduled', 'sending'] } },
      select: { name: true },
      take: 3,
    })
    if (pending.length > 0) {
      return NextResponse.json(
        { error: `This segment is used by unsent campaigns: ${pending.map(c => c.name).join(', ')}. Change or delete those campaigns first.` },
        { status: 409 }
      )
    }

    await prisma.segmentationRule.delete({
      where: { id: params.id }
    })
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete segment' }, { status: 500 })
  }
}
