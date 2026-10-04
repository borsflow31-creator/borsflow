import { NextRequest, NextResponse } from 'next/server'
import { failure } from '@/lib/api/respond'
import { sendPortalOTP } from '@/lib/services/developer/buyer-portal'

export const dynamic = 'force-dynamic'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params
    const result = await sendPortalOTP(token)
    return NextResponse.json(result)
  } catch (error) {
    return failure(error, 'Failed to send verification code', 'Error sending OTP')
  }
}
