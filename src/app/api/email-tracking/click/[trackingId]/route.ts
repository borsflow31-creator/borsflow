import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { EmailTrackingService } from '@/lib/email-tracking'

/**
 * Click tracking redirect.
 *
 * This used to redirect to any `?url=`, so the domain worked as an open redirect:
 * a link to /api/email-tracking/click/anything?url=https://evil.example looked
 * like ours and landed on theirs. It now only follows a link that was actually
 * in the tracked email. wrapLinksWithTracking writes each link as
 * `?url=<encodeURIComponent(link)>` into the stored HTML, so that exact string
 * must be present. Anything else goes to the app's home page.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { trackingId: string } }
) {
  const trackingId = params.trackingId
  const url = request.nextUrl.searchParams.get('url')
  const home = new URL('/', request.url)

  if (!url || !/^https?:\/\//i.test(url)) {
    return NextResponse.redirect(home)
  }

  const tracking = await prisma.emailTracking.findUnique({
    where: { trackingId },
    select: { email: { select: { htmlContent: true } } },
  })

  const inEmail = Boolean(tracking?.email?.htmlContent?.includes(`url=${encodeURIComponent(url)}`))
  if (!inEmail) {
    return NextResponse.redirect(home)
  }

  const ipAddress = request.ip || request.headers.get('x-forwarded-for') || undefined
  const userAgent = request.headers.get('user-agent') || undefined

  try {
    const trackingService = new EmailTrackingService()
    await trackingService.trackClick(trackingId, url, { ipAddress, userAgent })
  } catch (error) {
    console.error('Error tracking click:', error)
  }

  return NextResponse.redirect(url)
}
