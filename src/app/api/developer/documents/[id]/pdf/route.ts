import { NextRequest, NextResponse } from 'next/server'
import { getWorkspaceAccess } from '@/lib/crm/access'
import { failure } from '@/lib/api/respond'
import { getDocumentPdf } from '@/lib/services/developer/sales-documents'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

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
    const result = await getWorkspaceAccess(workspaceId)
    if ('error' in result) return result.error

    const { buffer, filename } = await getDocumentPdf(workspaceId, id, undefined, { canModerate: result.access.canModerate })
    return new Response(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${filename}"`,
        'Cache-Control': 'private, no-store',
      },
    })
  } catch (error) {
    return failure(error, 'Failed to load document', 'Error loading document')
  }
}
