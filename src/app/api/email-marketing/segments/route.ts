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


/**
 * Criteria arrive either as an array or, from SegmentModal, as a JSON string of
 * one. Normalise both to an array of { field, operator } objects, or null.
 *
 * The string form used to be passed straight to createSegmentRule, which
 * stringified it a second time. The stored value then parsed back to a string,
 * not an array, so it was evaluated as "no criteria" and matched every lead in the
 * workspace: every segment built in the UI silently became "everyone".
 */
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

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const workspaceId = searchParams.get('workspaceId')

  if (!workspaceId) {
    return NextResponse.json({ error: 'Workspace ID is required' }, { status: 400 })
  }

  try {
    const access = await requireWorkspaceAccess(workspaceId)
    if ('error' in access) {
      return NextResponse.json({ error: access.error }, { status: access.status })
    }

    const segments = await prisma.segmentationRule.findMany({
      where: { workspaceId }
    })
    return NextResponse.json({ segments })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch segments' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { workspaceId, name, description, criteria, tags } = body
  const subjectType = parseSubjectType(body.subjectType)
  if (!subjectType) {
    return NextResponse.json({ error: 'Unknown segment subject' }, { status: 400 })
  }
  // SegmentModal lets the user pick OR; this used to be hard-coded to AND, so an
  // "any of these" segment was silently narrowed to "all of these".
  const logicOperator: 'AND' | 'OR' = body.logicOperator === 'OR' ? 'OR' : 'AND'

  if (!workspaceId || !name || !criteria) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const parsedCriteria = parseCriteria(criteria)
  if (!parsedCriteria) {
    return NextResponse.json(
      { error: 'Criteria must be a list of conditions, each with a field and an operator' },
      { status: 400 }
    )
  }

  try {
    const access = await requireWorkspacePermission(workspaceId, 'content:create')
    if ('error' in access) {
      return NextResponse.json({ error: access.error }, { status: access.status })
    }

    const created = await emailSegmentationService.createSegmentRule(
      workspaceId,
      {
        name,
        description: description || '',
        subjectType,
        criteria: parsedCriteria,
        logicOperator,
        tags: Array.isArray(tags) ? tags : undefined,
        createdById: access.session.user.id
      }
    )

    // createSegmentRule computes the size after building its return value, so
    // read the row back to return the calculated estimatedSize.
    const segment = await prisma.segmentationRule.findUnique({ where: { id: created.id } })
    return NextResponse.json({ segment }, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create segment' }, { status: 500 })
  }
}
