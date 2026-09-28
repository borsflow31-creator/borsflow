import { NextRequest, NextResponse } from 'next/server'
import { EmailTrackingService } from '@/lib/email-tracking'
import { prisma } from '@/lib/prisma'
import { verifyUnsubscribeToken } from '@/lib/email/render'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const email = searchParams.get('email')
  const workspaceId = searchParams.get('w') || ''
  const campaignId = searchParams.get('campaign') || undefined

  if (!email) {
    return NextResponse.json({ error: 'Missing email parameter' }, { status: 400 })
  }

  // Every unsubscribe link we send is signed (buildUnsubscribeUrl) over the
  // address and the sending workspace. The token used to be ignored here, so
  // anyone could unsubscribe any address by editing the URL.
  if (!verifyUnsubscribeToken(email, workspaceId, searchParams.get('token'))) {
    return NextResponse.json({ error: 'This unsubscribe link is not valid' }, { status: 403 })
  }

  try {
    const trackingService = new EmailTrackingService()

    // Attempt to find lead ID based on email, among this workspace's mail only
    const recipient = await prisma.emailRecipient.findFirst({
      where: { recipientEmail: email, email: { workspaceId } }
    })

    await trackingService.trackUnsubscribe({
      workspaceId,
      email,
      campaignId,
      leadId: recipient?.leadId || undefined,
      source: 'link',
      unsubscribedAt: new Date()
    })

    // DESIGN.md's paper palette, laid out like the sign-up success state: a 48px
    // emerald-dim disc holding one emerald glyph, the heading, one muted line.
    // The opt-out is recorded for the sending workspace only, and the copy says so.
    return new NextResponse(`
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <title>Unsubscribed</title>
          <style>
            body { margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 16px; box-sizing: border-box; background: #f7f7fa; font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
            .card { max-width: 420px; text-align: center; background: #ffffff; border: 1px solid #e5e7ee; border-radius: 20px; padding: 32px; }
            .disc { width: 48px; height: 48px; margin: 0 auto 16px; border-radius: 9999px; background: rgba(4, 120, 87, 0.10); color: #047857; display: flex; align-items: center; justify-content: center; }
            h1 { margin: 0 0 8px; font-family: 'Albert Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 22px; line-height: 1.25; font-weight: 600; letter-spacing: -0.025em; color: #0d0e15; }
            p { margin: 0; font-size: 14px; line-height: 1.625; color: #52566b; }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="disc">
              <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1>You’re unsubscribed.</h1>
            <p>You won’t get these emails from this sender again.</p>
          </div>
        </body>
      </html>
    `, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' }
    })
  } catch (error) {
    console.error('Error tracking unsubscribe:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
