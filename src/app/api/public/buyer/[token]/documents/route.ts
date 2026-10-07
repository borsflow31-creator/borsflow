import { NextRequest, NextResponse } from 'next/server'
import { failure } from '@/lib/api/respond'
import { authenticateBuyerSession } from '@/lib/services/developer/buyer-portal'
import { listBuyerDocuments } from '@/lib/services/developer/sales-documents'

export const dynamic = 'force-dynamic'

/** The documents sent to this buyer. Behind the one-time code, like prices and payments. */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params
    const header = request.headers.get('Authorization')
    const session = header?.startsWith('Bearer ') ? header.slice(7).trim() : undefined
    const { lot } = await authenticateBuyerSession(token, session)
    return NextResponse.json({ documents: await listBuyerDocuments(lot.id) })
  } catch (error) {
    return failure(error, 'Failed to load documents', 'Error loading buyer documents')
  }
}
