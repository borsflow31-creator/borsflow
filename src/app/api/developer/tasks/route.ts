import { NextRequest, NextResponse } from 'next/server'
import { getDeveloperAccess } from '@/lib/crm/access'
import { failure, readBody, INVALID_BODY } from '@/lib/api/respond'
import { createTask, listTasks, type TaskFilters } from '@/lib/services/developer/tasks'

export const dynamic = 'force-dynamic'

const SCOPES = ['mine', 'all'] as const
const STATUSES = ['open', 'done', 'overdue', 'all'] as const

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

    const scope = params.get('scope')
    const status = params.get('status')
    const filters: TaskFilters = {
      scope: (SCOPES as readonly string[]).includes(scope ?? '') ? (scope as TaskFilters['scope']) : 'mine',
      status: (STATUSES as readonly string[]).includes(status ?? '') ? (status as TaskFilters['status']) : 'open',
      leadId: params.get('leadId') || undefined,
      assigneeId: params.get('assigneeId') || undefined,
    }

    const tasks = await listTasks({ workspaceId, userId: access.userId }, filters)
    return NextResponse.json({ tasks })
  } catch (error) {
    return failure(error, 'Failed to fetch follow-ups', 'Error fetching follow-ups')
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

    const task = await createTask({ workspaceId, userId: access.userId }, body as any)
    return NextResponse.json({ task }, { status: 201 })
  } catch (error) {
    return failure(error, 'Failed to create follow-up', 'Error creating follow-up')
  }
}
