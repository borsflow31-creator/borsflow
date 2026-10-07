import { NextRequest, NextResponse } from 'next/server'
import { getWorkspaceAccess } from '@/lib/crm/access'
import { failure } from '@/lib/api/respond'
import { getReport, isReportName } from '@/lib/services/developer/reports'

export const dynamic = 'force-dynamic'

/** `YYYY-MM-DD` as the start of that day in UTC, or undefined if absent or not a date. */
function readDay(value: string | null): Date | undefined {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined
  const d = new Date(`${value}T00:00:00Z`)
  return Number.isNaN(d.getTime()) ? undefined : d
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ report: string }> }
) {
  try {
    const { report } = await params
    if (!isReportName(report)) {
      return NextResponse.json({ error: 'Unknown report' }, { status: 404 })
    }

    const search = request.nextUrl.searchParams
    const workspaceId = search.get('workspaceId')
    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace ID is required' }, { status: 400 })
    }
    const result = await getWorkspaceAccess(workspaceId)
    if ('error' in result) return result.error

    const from = readDay(search.get('from'))
    // The end date the user picks is a day they want included, so the window ends the day after.
    const toDay = readDay(search.get('to'))
    const to = toDay ? new Date(toDay.getTime() + 24 * 60 * 60 * 1000) : undefined

    const data = await getReport(
      { workspaceId, userId: result.access.userId },
      report,
      { from, to, groupBy: search.get('groupBy') === 'campaign' ? 'campaign' : 'source' }
    )
    return NextResponse.json({ report: data })
  } catch (error) {
    return failure(error, 'Failed to build report', 'Error building report')
  }
}
