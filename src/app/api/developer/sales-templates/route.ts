import { NextRequest, NextResponse } from 'next/server'
import { getDeveloperAccess } from '@/lib/crm/access'
import { failure, readBody, INVALID_BODY } from '@/lib/api/respond'
import { listTemplates, saveTemplate } from '@/lib/services/developer/sales-documents'
import { DEFAULT_TEMPLATES, MERGE_FIELDS } from '@/lib/documents/sales-merge'

export const dynamic = 'force-dynamic'

/** The workspace's templates, the built-in drafts they replace, and the placeholders available. */
export async function GET(request: NextRequest) {
  try {
    const workspaceId = request.nextUrl.searchParams.get('workspaceId')
    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace ID is required' }, { status: 400 })
    }
    const result = await getDeveloperAccess(workspaceId)
    if ('error' in result) return result.error

    const templates = await listTemplates({ workspaceId, userId: result.access.userId })
    return NextResponse.json({ templates, defaults: DEFAULT_TEMPLATES, fields: MERGE_FIELDS })
  } catch (error) {
    return failure(error, 'Failed to fetch templates', 'Error fetching templates')
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

    const template = await saveTemplate({ workspaceId, userId: result.access.userId }, body)
    return NextResponse.json({ template })
  } catch (error) {
    return failure(error, 'Failed to save template', 'Error saving template')
  }
}
