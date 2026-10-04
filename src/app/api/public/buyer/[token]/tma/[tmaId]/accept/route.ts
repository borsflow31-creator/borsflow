import { NextRequest, NextResponse } from 'next/server'
import { failure, readBody } from '@/lib/api/respond'
import { acceptBuyerTMAQuote } from '@/lib/services/developer/buyer-portal'

export const dynamic = 'force-dynamic'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string; tmaId: string }> }
) {
  try {
    const { token, tmaId } = await params
    const authHeader = request.headers.get('Authorization')
    const sessionToken = authHeader?.startsWith('Bearer ')
      ? authHeader.slice(7).trim()
      : undefined

    if (!sessionToken) {
      return NextResponse.json({ error: 'Session verification required' }, { status: 401 })
    }

    const body = (await readBody(request)) as Record<string, any> | null
    const signatureName =
      body && typeof body.signatureName === 'string'
        ? body.signatureName
        : 'Authorized Purchaser'

    const updated = await acceptBuyerTMAQuote(token, sessionToken, tmaId, signatureName)
    return NextResponse.json(updated)
  } catch (error) {
    return failure(error, 'Failed to sign and accept customization quote', 'Error accepting TMA quote')
  }
}
