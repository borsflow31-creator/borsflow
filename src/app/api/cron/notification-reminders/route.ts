/**
 * CRON: Meeting and task-due reminders, plus notification housekeeping.
 *
 * Runs hourly (see workers/cron's HOURLY_JOBS), so each window below is sized
 * to roughly one tick: a meeting starting in the next hour, a card due in the
 * next 24 hours. `notify()`'s per-recipient dedupeKey is what actually keeps a
 * second tick (or a retried one) from re-sending the same reminder, not the
 * window boundaries themselves.
 */

export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { isAuthorizedCron } from '@/lib/api/cron'
import { notify } from '@/lib/notifications/notify'
import { formatNotificationTime } from '@/lib/notifications/email'

/** Read notifications older than this are cleared out; unread ones are kept regardless of age. */
const READ_RETENTION_MS = 90 * 24 * 60 * 60 * 1000

function parseAssignees(value: string | null): string[] {
  if (!value) return []
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : []
  } catch {
    return []
  }
}

export async function POST(request: NextRequest) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const now = new Date()
    const in1h = new Date(now.getTime() + 60 * 60 * 1000)
    const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000)

    const [upcomingMeetings, dueCards] = await Promise.all([
      prisma.meeting.findMany({
        where: { status: 'scheduled', startTime: { gte: now, lte: in1h } },
        select: { id: true, workspaceId: true, userId: true, title: true, startTime: true, timezone: true },
      }),
      prisma.kanbanCard.findMany({
        where: { status: { not: 'done' }, dueDate: { gte: now, lte: in24h } },
        select: { id: true, workspaceId: true, title: true, dueDate: true, assignees: true, createdById: true },
      }),
    ])

    let meetingReminders = 0
    for (const meeting of upcomingMeetings) {
      if (!meeting.userId) continue
      meetingReminders++
      void notify({
        recipients: [meeting.userId],
        type: 'meetings.reminder',
        workspaceId: meeting.workspaceId,
        title: `Starting soon: ${meeting.title}`,
        // The meeting's own zone, named, rather than the cron host's locale.
        body: formatNotificationTime({ at: meeting.startTime, timeZone: meeting.timezone }),
        when: { at: meeting.startTime, timeZone: meeting.timezone },
        href: `/meetings?workspace=${meeting.workspaceId}`,
        dedupeKey: `meeting.reminder:${meeting.id}`,
      })
    }

    let taskReminders = 0
    for (const card of dueCards) {
      const recipients = parseAssignees(card.assignees)
      const fallback = recipients.length === 0 && card.createdById ? [card.createdById] : []
      const targets = recipients.length > 0 ? recipients : fallback
      if (targets.length === 0) continue
      taskReminders++
      void notify({
        recipients: targets,
        type: 'tasks.card_due_soon',
        workspaceId: card.workspaceId,
        title: `Due soon: "${card.title}"`,
        body: card.dueDate ? formatNotificationTime({ at: card.dueDate }) : undefined,
        when: card.dueDate ? { at: card.dueDate } : undefined,
        href: `/kanban-board-view?workspace=${card.workspaceId}`,
        dedupeKey: `card.due:${card.id}`,
      })
    }

    const { count: cleaned } = await prisma.notification.deleteMany({
      where: { readAt: { lt: new Date(now.getTime() - READ_RETENTION_MS) } },
    })

    return NextResponse.json({
      message: 'Reminder sweep completed',
      meetingReminders,
      taskReminders,
      cleaned,
      timestamp: now.toISOString(),
    })
  } catch (error) {
    console.error('Error running notification reminders:', error)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}

// Vercel Cron sends GET
export async function GET(request: NextRequest) {
  return POST(request)
}
