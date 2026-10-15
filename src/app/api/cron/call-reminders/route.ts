/**
 * CRON: Payment reminders for calls for funds.
 *
 * Does two things, hourly:
 *
 *  1. Marks unpaid calls past their due date `overdue`. The status existed in the
 *     schema and the screens, but nothing ever wrote it, so every reader had to
 *     work it out from the date and no query could filter on it.
 *  2. Emails the buyer the reminder that is due: a week before, on the day, then
 *     three, seven and fourteen days late (see lib/crm/reminders). The late ones
 *     also tell the unit's agent and the workspace owner.
 *
 * Safe to run twice, or after a gap. A step is recorded in CallReminder only after
 * the email has gone, and only the latest step reached is ever sent, so a repeat
 * finds nothing to do and an outage sends one reminder, not a backlog.
 *
 * Registered in the Cloudflare scheduler Worker's hourly jobs (workers/cron).
 */

export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { callAmounts } from '@/lib/services/developer/call-balance'
import { prisma } from '@/lib/prisma'
import { isAuthorizedCron } from '@/lib/api/cron'
import { emailParagraph, renderEmail } from '@/lib/email'
import { sendNoticeEmail } from '@/lib/email/notice'
import { escapeHtml } from '@/lib/html'
import { notify } from '@/lib/notifications/notify'
import { renderTemplate } from '@/lib/documents/sales-merge'
import { LATE_STEPS, reminderStepFor } from '@/lib/crm/reminders'
import {
  buyerPortalUrl,
  getEffectiveTemplate,
  loadLotForValues,
  saleValues,
} from '@/lib/services/developer/sales-documents'
import { ensureLotPublicToken } from '@/lib/services/developer/lots'
import { DEFAULT_CURRENCY } from '@/lib/currencies'

const DAY_MS = 24 * 60 * 60 * 1000
/** Calls this far past due are left alone: a month on, a reminder email is not the tool. */
const STOP_AFTER_DAYS = 30
const BATCH = 500

const OPEN_STATUSES = ['issued', 'sent_to_bank', 'partially_paid', 'overdue']

export async function POST(request: NextRequest) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const now = new Date()

    const flipped = await prisma.callForFunds.updateMany({
      where: { status: { in: ['issued', 'sent_to_bank', 'partially_paid'] }, dueAt: { lt: now } },
      data: { status: 'overdue' },
    })

    const calls = await prisma.callForFunds.findMany({
      where: {
        status: { in: OPEN_STATUSES },
        dueAt: { gte: new Date(now.getTime() - STOP_AFTER_DAYS * DAY_MS), lte: new Date(now.getTime() + 8 * DAY_MS) },
      },
      orderBy: { dueAt: 'asc' },
      take: BATCH,
      select: {
        id: true,
        callNumber: true,
        amount: true,
        dueAt: true,
        lotId: true,
        workspaceId: true,
        milestone: { select: { title: true } },
        status: true,
        invoice: { select: { currency: true, amountPaid: true } },
        reminders: { select: { step: true } },
        lot: {
          select: {
            lotNumber: true,
            salesAgentId: true,
            program: { select: { id: true, name: true } },
            workspace: { select: { name: true, ownerId: true, currency: true } },
            buyerLead: { select: { email: true } },
          },
        },
      },
    })

    let sent = 0
    let suppressed = 0
    let failed = 0

    for (const call of calls) {
      if (!call.dueAt) continue
      const step = reminderStepFor(call.dueAt, now, call.reminders.map((r) => r.step))
      if (!step) continue

      const email = call.lot.buyerLead?.email
      if (!email) continue

      // Remind of what is still owed: a part payment lowers the amount asked.
      const owed = callAmounts(call, now.getTime()).outstanding
      if (owed <= 0) continue

      try {
        const lot = await loadLotForValues(call.workspaceId, call.lotId)
        if (!lot) continue

        const token = await ensureLotPublicToken(call.lotId)
        const currency = call.invoice?.currency || call.lot.workspace.currency || DEFAULT_CURRENCY
        const template = await getEffectiveTemplate(call.workspaceId, call.lot.program.id, 'payment_reminder')

        const values = {
          ...saleValues(lot),
          amount_due: new Intl.NumberFormat('en', { style: 'currency', currency }).format(owed),
          milestone: call.milestone.title,
          due_date: call.dueAt.toISOString().slice(0, 10),
          portal_link: buyerPortalUrl(token),
        }

        const body = renderTemplate(template.body, values)
        const subject = renderTemplate(template.subject ?? 'Payment due for unit {{unit}}', values)
        if (body.unknown.length > 0 || subject.unknown.length > 0) {
          console.error('[call-reminders] template has unknown placeholders; skipping', call.id)
          failed++
          continue
        }

        const html = renderEmail({
          title: escapeHtml(subject.text),
          preheader: escapeHtml(subject.text),
          heading: escapeHtml(subject.text),
          body: body.text
            .split(/\n{2,}/)
            .map((p) => p.trim())
            .filter(Boolean)
            .map((p) => emailParagraph(escapeHtml(p).replace(/\n/g, '<br>')))
            .join(''),
          action: { label: 'Open your purchase space', url: escapeHtml(buyerPortalUrl(token)) },
          footer: `Sent on behalf of ${escapeHtml(call.lot.workspace.name)}.`,
        })

        const outcome = await sendNoticeEmail({
          workspaceId: call.workspaceId,
          to: email,
          subject: subject.text,
          html,
          text: body.text,
          senderName: call.lot.workspace.name,
        })

        if (outcome === 'suppressed') {
          suppressed++
          continue
        }

        // After the send, not before: a failed send leaves no row, so the next hour tries again.
        await prisma.callReminder.create({ data: { callId: call.id, step } }).catch((error: any) => {
          if (error?.code !== 'P2002') throw error
        })
        sent++

        if (LATE_STEPS.includes(step)) {
          const recipients = Array.from(new Set([call.lot.salesAgentId, call.lot.workspace.ownerId].filter((id): id is string => !!id)))
          void notify({
            recipients,
            type: 'crm.call_overdue',
            workspaceId: call.workspaceId,
            title: `Overdue payment: unit ${call.lot.lotNumber}`,
            body: `${call.lot.program.name} · ${call.milestone.title}`,
            href: `/developer/collections?workspace=${call.workspaceId}`,
            dedupeKey: `call.overdue:${call.id}:${step}`,
          })
        }
      } catch (error) {
        failed++
        console.error('[call-reminders] failed for call', call.id, error)
      }
    }

    return NextResponse.json({
      message: 'Call reminders completed',
      markedOverdue: flipped.count,
      considered: calls.length,
      sent,
      suppressed,
      failed,
      timestamp: now.toISOString(),
    })
  } catch (error) {
    console.error('Error running call reminders:', error)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}

// Same pattern as the other cron routes: the scheduler may use either verb.
export async function GET(request: NextRequest) {
  return POST(request)
}
