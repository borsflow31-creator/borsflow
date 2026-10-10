import { NextRequest, NextResponse } from 'next/server'
import { getDeveloperAccess } from '@/lib/crm/access'
import { failure, readBody, INVALID_BODY } from '@/lib/api/respond'
import { listLotsForProgram, createLot } from '@/lib/services/developer/lots'

export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: programId } = await params
    const searchParams = request.nextUrl.searchParams
    const workspaceId = searchParams.get('workspaceId')
    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace ID is required' }, { status: 400 })
    }

    const result = await getDeveloperAccess(workspaceId)
    if ('error' in result) return result.error
    const { access } = result

    const buildingId = searchParams.get('buildingId') || undefined
    const status = searchParams.get('status') || undefined
    const type = searchParams.get('type') || undefined

    const lots = await listLotsForProgram(
      { workspaceId, userId: access.userId },
      programId,
      { buildingId, status, type }
    )
    return NextResponse.json({ lots })
  } catch (error) {
    return failure(error, 'Failed to fetch lots', 'Error fetching lots')
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: programId } = await params
    const body = await readBody(request)
    if (!body) return INVALID_BODY()

    const workspaceId = typeof body.workspaceId === 'string' ? body.workspaceId : ''
    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace ID is required' }, { status: 400 })
    }

    const result = await getDeveloperAccess(workspaceId, { write: true })
    if ('error' in result) return result.error
    const { access } = result

    const lot = await createLot(
      { workspaceId, userId: access.userId },
      { ...body, programId } as any
    )
    return NextResponse.json({ lot }, { status: 201 })
  } catch (error) {
    return failure(error, 'Failed to create lot', 'Error creating lot')
  }
}
