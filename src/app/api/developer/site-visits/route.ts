import { NextRequest, NextResponse } from 'next/server'
import { getWorkspaceAccess } from '@/lib/crm/access'
import { failure, readBody, INVALID_BODY } from '@/lib/api/respond'
import { createSiteVisit, listSiteVisits, type VisitWhen } from '@/lib/services/developer/site-visits'

export const dynamic = 'force-dynamic'

const WHEN: readonly string[] = ['upcoming', 'past', 'needs_outcome', 'all']

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams
    const workspaceId = params.get('workspaceId')
    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace ID is required' }, { status: 400 })
    }

    const result = await getWorkspaceAccess(workspaceId)
    if ('error' in result) return result.error

    const when = params.get('when') ?? 'upcoming'
    const visits = await listSiteVisits(
      { workspaceId, userId: result.access.userId },
      {
        when: WHEN.includes(when) ? (when as VisitWhen) : 'upcoming',
        programId: params.get('programId') || undefined,
        hostId: params.get('hostId') || undefined,
        leadId: params.get('leadId') || undefined,
      }
    )
    return NextResponse.json({ visits })
  } catch (error) {
    return failure(error, 'Failed to fetch site visits', 'Error fetching site visits')
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await readBody(request)
    if (!body) return INVALID_BODY()

    const workspaceId = typeof body.workspaceId === 'string' ? body.workspaceId : ''
    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace ID is required' }, { status: 400 })
    }

    const result = await getWorkspaceAccess(workspaceId, { write: true })
    if ('error' in result) return result.error

    const visit = await createSiteVisit({ workspaceId, userId: result.access.userId }, body)
    return NextResponse.json({ visit }, { status: 201 })
  } catch (error) {
    return failure(error, 'Failed to book site visit', 'Error booking site visit')
  }
}
