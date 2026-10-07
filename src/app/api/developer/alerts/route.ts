import { NextRequest, NextResponse } from 'next/server'
import { getWorkspaceAccess } from '@/lib/crm/access'
import { failure, readBody, INVALID_BODY } from '@/lib/api/respond'
import { RULE_PARAMS } from '@/lib/crm/alert-rules'
import { getRules, saveRule } from '@/lib/services/developer/alerts'

export const dynamic = 'force-dynamic'

/** The workspace's alert rules, with who may change them and what each can be tuned by. */
export async function GET(request: NextRequest) {
  try {
    const workspaceId = request.nextUrl.searchParams.get('workspaceId')
    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace ID is required' }, { status: 400 })
    }
    const result = await getWorkspaceAccess(workspaceId)
    if ('error' in result) return result.error

    return NextResponse.json({
      rules: await getRules(workspaceId),
      limits: RULE_PARAMS,
      canEdit: result.access.canModerate,
    })
  } catch (error) {
    return failure(error, 'Failed to fetch alerts', 'Error fetching alerts')
  }
}

/** Save one rule: `{ workspaceId, type, enabled, params }`. Owners and admins only. */
export async function PUT(request: NextRequest) {
  try {
    const body = await readBody(request)
    if (!body) return INVALID_BODY()

    const workspaceId = typeof body.workspaceId === 'string' ? body.workspaceId : ''
    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace ID is required' }, { status: 400 })
    }
    const result = await getWorkspaceAccess(workspaceId, { write: true })
    if ('error' in result) return result.error

    await saveRule(
      { workspaceId, userId: result.access.userId, canModerate: result.access.canModerate },
      body
    )
    return NextResponse.json({ rules: await getRules(workspaceId) })
  } catch (error) {
    return failure(error, 'Failed to save alert', 'Error saving alert')
  }
}
