import { NextRequest } from 'next/server'
import { EmailTrackingService } from '@/lib/email-tracking'

const pixel = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64'
)

export async function GET(
  request: NextRequest,
  { params }: { params: { trackingId: string } }
) {
  const trackingId = params.trackingId
  const ipAddress = request.ip || request.headers.get('x-forwarded-for') || undefined
  const userAgent = request.headers.get('user-agent') || undefined

  try {
    const trackingService = new EmailTrackingService()
    await trackingService.trackOpen(trackingId, { ipAddress, userAgent })
  } catch (error) {
    console.error('Error tracking open:', error)
  }

  return new Response(pixel, {
    headers: {
      'Content-Type': 'image/gif',
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
    },
  })
}
