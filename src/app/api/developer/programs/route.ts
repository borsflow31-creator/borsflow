import { NextRequest, NextResponse } from 'next/server'
import { getDeveloperAccess } from '@/lib/crm/access'
import { failure, readBody, INVALID_BODY } from '@/lib/api/respond'
import { listPrograms, createProgram } from '@/lib/services/developer/programs'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams
    const workspaceId = params.get('workspaceId')
    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace ID is required' }, { status: 400 })
    }

    const result = await getDeveloperAccess(workspaceId)
    if ('error' in result) return result.error
    const { access } = result

    const status = params.get('status') || undefined
    const search = params.get('search') || undefined

    const programs = await listPrograms({ workspaceId, userId: access.userId }, { status, search })
    return NextResponse.json({ programs })
  } catch (error) {
    return failure(error, 'Failed to fetch programs', 'Error fetching programs')
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

    const result = await getDeveloperAccess(workspaceId, { write: true })
    if ('error' in result) return result.error
    const { access } = result

    const program = await createProgram({ workspaceId, userId: access.userId }, body as any)
    return NextResponse.json({ program }, { status: 201 })
  } catch (error) {
    return failure(error, 'Failed to create program', 'Error creating program')
  }
}
