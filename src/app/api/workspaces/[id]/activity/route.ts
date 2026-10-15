import { NextRequest, NextResponse } from 'next/server'
import { getWorkspaceAccess } from '@/lib/crm/access'
import { failure } from '@/lib/api/respond'
import { isActivityGroup, listWorkspaceActivity, type AuditLogEntry } from '@/lib/services/team/audit-log'

export const dynamic = 'force-dynamic'

/** A CSV export is capped so one click cannot pull an unbounded history. */
const CSV_LIMIT = 5000

/**
 * GET /api/workspaces/[id]/activity
 * The workspace's activity log, for the owner and admins only: what everyone did,
 * filtered by `userId`, `group`, `from` / `to` (YYYY-MM-DD, `to` inclusive) and
 * paged by `cursor`. `format=csv` downloads the filtered log instead.
 */
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const result = await getWorkspaceAccess(params.id)
    if ('error' in result) return result.error
    if (!result.access.canModerate) {
      return NextResponse.json({ error: 'Only admins can see the activity log' }, { status: 403 })
    }

    const q = request.nextUrl.searchParams
    const group = q.get('group')
    const from = parseDay(q.get('from'))
    const to = parseDay(q.get('to'))
    const filter = {
      userId: q.get('userId') || undefined,
      group: isActivityGroup(group) ? group : undefined,
      from: from ?? undefined,
      // The picked end day is included: stop at the start of the next one.
      to: to ? new Date(to.getTime() + 24 * 60 * 60 * 1000) : undefined,
    }

    if (q.get('format') === 'csv') {
      const { entries } = await listWorkspaceActivity(params.id, { ...filter, limit: CSV_LIMIT })
      return new NextResponse(toCsv(entries), {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="activity-log-${new Date().toISOString().slice(0, 10)}.csv"`,
        },
      })
    }

    const limit = Number(q.get('limit')) || undefined
    const page = await listWorkspaceActivity(params.id, { ...filter, cursor: q.get('cursor') || undefined, limit })
    return NextResponse.json(page)
  } catch (error) {
    return failure(error, 'Failed to load the activity log', 'Error loading workspace activity log')
  }
}

function parseDay(value: string | null): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const d = new Date(`${value}T00:00:00.000Z`)
  return Number.isNaN(d.getTime()) ? null : d
}

function toCsv(entries: AuditLogEntry[]): string {
  const cell = (raw: string) => {
    // A leading = + - @ would run as a formula in a spreadsheet.
    const v = /^[=+\-@]/.test(raw) ? `'${raw}` : raw
    return /[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v
  }
  const lines = [['date', 'person', 'email', 'event', 'description'].join(',')]
  for (const e of entries) {
    lines.push([e.createdAt, e.actor.name, e.actor.email, e.type, e.description].map(cell).join(','))
  }
  // BOM so Excel opens accented names correctly.
  return '\uFEFF' + lines.join('\r\n')
}
