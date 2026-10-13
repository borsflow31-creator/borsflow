import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { requireWorkspacePermission } from '@/lib/api/workspace'
import { consumeRateLimits, rateLimitedResponse, type RateLimitAction } from '@/lib/api/rate-limit'
import { emailMarketingService } from '@/lib/email-marketing'
import { isSendableTransactional } from '@/lib/email/suppression'
import { renderWithSamples } from '@/lib/email/tokens'
import { htmlToPlainText } from '@/lib/email-editor-mode'

/**
 * POST /api/email-marketing/templates/test
 * Body: { workspaceId, subject, htmlContent, textContent? }
 *
 * Mail this draft to yourself, to see what it looks like in a real inbox before
 * anyone else gets it. There was no way to do that: a template could only be
 * proofread in an iframe, which says nothing about how Gmail or Outlook will
 * render it.
 *
 * Three things keep it from being a way to send mail at someone:
 *
 *  - the recipient is always the signed-in user's own address, never a value
 *    from the request;
 *  - the body is the draft in the request rather than a saved template, because
 *    the point is to test before saving — but it is rendered with sample values,
 *    so it reaches no real lead's data;
 *  - it is rate limited per user, and it writes nothing to campaign stats.
 */

const TEST_SEND_LIMIT = {
  bucket: 'email:test-send',
  limit: 20,
  windowMs: 60 * 60 * 1000,
  windowLabel: 'hour',
} as const

const TEST_SEND_ACTION: RateLimitAction = { noun: 'test email', verb: 'send' }

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  const recipient = session?.user?.email
  if (!session?.user?.id || !recipient) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: any
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const workspaceId = typeof body?.workspaceId === 'string' ? body.workspaceId : ''
  const subject = typeof body?.subject === 'string' ? body.subject.trim() : ''
  const htmlContent = typeof body?.htmlContent === 'string' ? body.htmlContent : ''
  if (!workspaceId || !subject || !htmlContent.trim()) {
    return NextResponse.json({ error: 'A workspace, a subject and a body are required' }, { status: 400 })
  }

  // Sending costs the workspace's own provider quota, so it needs the same
  // permission as creating the content it sends.
  const access = await requireWorkspacePermission(workspaceId, 'content:create')
  if ('error' in access) {
    return NextResponse.json({ error: access.error }, { status: access.status })
  }

  const limit = await consumeRateLimits(
    [{ subject: `user:${session.user.id}`, rule: TEST_SEND_LIMIT }],
    1
  )
  if (!limit.allowed) return rateLimitedResponse(limit, 1, TEST_SEND_ACTION)

  // Their own address can still be on the suppression list — a bounce from an
  // earlier test. Marketing opt-out does not apply: this is their own proof copy.
  if (!(await isSendableTransactional(recipient, workspaceId))) {
    return NextResponse.json(
      { error: 'Your own address is on this workspace\'s suppression list, so nothing was sent.' },
      { status: 409 }
    )
  }

  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { name: true },
  })

  const html = renderWithSamples(htmlContent, workspace?.name)
  const text = typeof body?.textContent === 'string' && body.textContent.trim()
    ? renderWithSamples(body.textContent, workspace?.name)
    : htmlToPlainText(html)

  try {
    await emailMarketingService.loadProviders(workspaceId)
    const result = await emailMarketingService.sendEmail(
      {
        to: recipient,
        // Marked in the subject so a proof copy is never mistaken for the real
        // send when it turns up weeks later in a search.
        subject: `[Test] ${renderWithSamples(subject, workspace?.name)}`,
        html,
        text,
      },
      { workspaceId }
    )

    if (!result.success) {
      return NextResponse.json({ error: result.error || 'The test email could not be sent' }, { status: 502 })
    }
    return NextResponse.json({ sent: true, to: recipient })
  } catch (error: any) {
    // No provider configured is the common case here, and its message says so.
    return NextResponse.json(
      { error: error?.message || 'The test email could not be sent' },
      { status: 502 }
    )
  }
}
