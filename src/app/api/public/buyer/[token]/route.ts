import { NextRequest, NextResponse } from 'next/server'
import { failure } from '@/lib/api/respond'
import { getBuyerPortalData } from '@/lib/services/developer/buyer-portal'

export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params
    const authHeader = request.headers.get('Authorization')
    const sessionToken = authHeader?.startsWith('Bearer ')
      ? authHeader.slice(7).trim()
      : undefined

    const data = await getBuyerPortalData(token, sessionToken)
    return NextResponse.json(data)
  } catch (error) {
    return failure(error, 'Failed to load buyer portal', 'Error loading buyer portal')
  }
}
