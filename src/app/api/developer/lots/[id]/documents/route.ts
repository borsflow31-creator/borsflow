import { NextRequest, NextResponse } from 'next/server'
import { getDeveloperAccess } from '@/lib/crm/access'
import { failure, readBody, INVALID_BODY } from '@/lib/api/respond'
import { issueDocument, listDocumentsForLot } from '@/lib/services/developer/sales-documents'

export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const workspaceId = request.nextUrl.searchParams.get('workspaceId')
    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace ID is required' }, { status: 400 })
    }
    const result = await getDeveloperAccess(workspaceId)
    if ('error' in result) return result.error

    const documents = await listDocumentsForLot({ workspaceId, userId: result.access.userId }, id, result.access.canModerate)
    return NextResponse.json({ documents, canManage: result.access.canModerate })
  } catch (error) {
    return failure(error, 'Failed to fetch documents', 'Error fetching documents')
  }
}

/** Issue a reservation form or contract: `{ workspaceId, kind: 'reservation' | 'contract' }`. */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await readBody(request)
    if (!body) return INVALID_BODY()

    const workspaceId = typeof body.workspaceId === 'string' ? body.workspaceId : ''
    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace ID is required' }, { status: 400 })
    }
    const result = await getDeveloperAccess(workspaceId, { write: true })
    if ('error' in result) return result.error

    const issued = await issueDocument({ workspaceId, userId: result.access.userId }, id, body.kind)
    return NextResponse.json(issued, { status: 201 })
  } catch (error) {
    return failure(error, 'Failed to issue document', 'Error issuing document')
  }
}
