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

    return new NextResponse(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Unsubscribed</title>
          <style>
            body { font-family: system-ui, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background-color: #f9fafb; }
            .container { text-align: center; background: white; padding: 2rem; border-radius: 8px; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1); }
            h1 { color: #111827; margin-bottom: 0.5rem; }
            p { color: #4b5563; }
          </style>
        </head>
        <body>
          <div class="container">
            <svg style="width: 48px; height: 48px; color: #10B981; margin: 0 auto 1rem;" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
            </svg>
            <h1>You have been unsubscribed</h1>
            <p>You will no longer receive these emails.</p>
          </div>
        </body>
      </html>
    `, {
      headers: { 'Content-Type': 'text/html' }
    })
  } catch (error) {
    console.error('Error tracking unsubscribe:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
