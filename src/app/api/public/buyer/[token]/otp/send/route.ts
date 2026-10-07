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
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    const result = await sendPortalOTP(token, ip)
    return NextResponse.json(result)
  } catch (error) {
    return failure(error, 'Failed to send verification code', 'Error sending OTP')
  }
}
