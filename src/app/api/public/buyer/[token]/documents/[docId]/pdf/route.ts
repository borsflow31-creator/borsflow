import { NextRequest } from 'next/server'
import { failure } from '@/lib/api/respond'
import { authenticateBuyerSession } from '@/lib/services/developer/buyer-portal'
import { getDocumentPdf } from '@/lib/services/developer/sales-documents'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string; docId: string }> }
) {
  try {
    const { token, docId } = await params
    const header = request.headers.get('Authorization')
    const session = header?.startsWith('Bearer ') ? header.slice(7).trim() : undefined
    const { lot } = await authenticateBuyerSession(token, session)

    const { buffer, filename } = await getDocumentPdf(lot.workspaceId, docId, { lotId: lot.id, issuedOnly: true })
    return new Response(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${filename}"`,
        'Cache-Control': 'private, no-store',
      },
    })
  } catch (error) {
    return failure(error, 'Failed to load document', 'Error loading buyer document')
  }
}
