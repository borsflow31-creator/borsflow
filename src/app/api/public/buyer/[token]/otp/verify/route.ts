import { NextRequest, NextResponse } from 'next/server'
import { failure, readBody, INVALID_BODY } from '@/lib/api/respond'
import { verifyPortalOTP } from '@/lib/services/developer/buyer-portal'

export const dynamic = 'force-dynamic'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id?: string; token: string }> }
) {
  try {
    const { token } = await params
    const body = await readBody(request)
    if (!body || typeof body.code !== 'string') {
      return NextResponse.json({ error: 'Verification code is required' }, { status: 400 })
    }

    const result = await verifyPortalOTP(token, body.code)
    return NextResponse.json(result)
  } catch (error) {
    return failure(error, 'Failed to verify code', 'Error verifying OTP')
  }
}
