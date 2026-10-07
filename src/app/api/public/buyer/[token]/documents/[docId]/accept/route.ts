import { NextRequest, NextResponse } from 'next/server'
import { failure, readBody, INVALID_BODY } from '@/lib/api/respond'
import { authenticateBuyerSession } from '@/lib/services/developer/buyer-portal'
import { acceptDocument } from '@/lib/services/developer/sales-documents'

export const dynamic = 'force-dynamic'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string; docId: string }> }
) {
  try {
    const { token, docId } = await params
    const header = request.headers.get('Authorization')
    const session = header?.startsWith('Bearer ') ? header.slice(7).trim() : undefined
    const { lot } = await authenticateBuyerSession(token, session)

    const body = await readBody(request)
    if (!body) return INVALID_BODY()

    // What identifies the acceptance beyond the typed name: where it came from and
    // on what device, taken from the request rather than trusted from the body.
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null
    const userAgent = request.headers.get('user-agent')

    const document = await acceptDocument(lot.id, docId, { name: body.name, confirm: body.confirm }, { ip, userAgent })
    return NextResponse.json({ document })
  } catch (error) {
    return failure(error, 'Failed to accept document', 'Error accepting document')
  }
}
