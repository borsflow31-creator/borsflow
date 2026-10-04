import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getWorkspaceAccess } from '@/lib/crm/access'
import { forecast } from '@/lib/services/commissions'
import { failure } from '@/lib/api/respond'

export const dynamic = 'force-dynamic'

// GET /api/commissions/forecast?workspaceId=…
// What the pipeline is worth, weighted by how far each listing has got. A planning
// number: computed on request, never stored, because nobody is owed it yet.
export async function GET(request: NextRequest) {
  try {
    const workspaceId = request.nextUrl.searchParams.get('workspaceId')
    if (!workspaceId) return NextResponse.json({ error: 'Workspace ID is required' }, { status: 400 })

    const result = await getWorkspaceAccess(workspaceId)
    if ('error' in result) return result.error
    const { access } = result

    const data = await forecast(workspaceId)
    // An agent sees their own pipeline; the owner and admins see everyone's.
    const rows = access.canModerate ? data.rows : data.rows.filter(r => r.userId === access.userId)

    const users = await prisma.user.findMany({
      where: { id: { in: rows.map(r => r.userId).filter((id): id is string => !!id) } },
      select: { id: true, name: true, email: true },
    })
    const names = new Map(users.map(u => [u.id, u.name || u.email]))

    return NextResponse.json({
      rows: rows.map(r => ({ ...r, name: r.userId ? names.get(r.userId) ?? '' : '' })),
      potential: rows.reduce((s, r) => s + r.potential, 0),
      weighted: rows.reduce((s, r) => s + r.weighted, 0),
    })
  } catch (error) {
    return failure(error, 'Failed to build the forecast', 'Error building commission forecast')
  }
}
