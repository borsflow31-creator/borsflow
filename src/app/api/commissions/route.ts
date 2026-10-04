import { NextRequest, NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getWorkspaceAccess } from '@/lib/crm/access'
import { commissionInclude } from '@/lib/services/commissions'
import { failure } from '@/lib/api/respond'

export const dynamic = 'force-dynamic'

// GET /api/commissions?workspaceId=…&status=accrued,realized&mine=1
//
// Commissions with their shares, plus what each member is owed. `mine` narrows to the
// commissions the caller has a share of, which is what an agent looks at on payday;
// an owner or admin sees everyone's. A viewer is read-only but sees what a member sees.
export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams
    const workspaceId = params.get('workspaceId')
    if (!workspaceId) return NextResponse.json({ error: 'Workspace ID is required' }, { status: 400 })

    const result = await getWorkspaceAccess(workspaceId)
    if ('error' in result) return result.error
    const { access } = result

    const where: Prisma.CommissionWhereInput = { workspaceId }
    const statuses = (params.get('status') ?? '').split(',').filter(Boolean)
    if (statuses.length) where.status = { in: statuses }
    // Not an admin: you see commissions you earn from, and no one else's pay.
    if (params.get('mine') === '1' || !access.canModerate) where.splits = { some: { userId: access.userId } }

    const commissions = await prisma.commission.findMany({
      where,
      include: commissionInclude,
      orderBy: { createdAt: 'desc' },
      take: 200,
    })

    // What each member is owed, by state. An agent sees only their own line.
    const owed = new Map<string, { userId: string | null; name: string; accrued: number; realized: number; paid: number }>()
    for (const c of commissions) {
      if (c.status === 'cancelled') continue
      for (const s of c.splits) {
        if (!access.canModerate && s.userId !== access.userId) continue
        const key = s.userId ?? 'agency'
        const row = owed.get(key) ?? { userId: s.userId, name: s.user?.name || s.user?.email || '', accrued: 0, realized: 0, paid: 0 }
        row[c.status === 'paid' ? 'paid' : c.status === 'realized' ? 'realized' : 'accrued'] += s.amount
        owed.set(key, row)
      }
    }

    // A non-admin does not see the shares of other people.
    const visible = access.canModerate
      ? commissions
      : commissions.map(c => ({ ...c, splits: c.splits.filter(s => s.userId === access.userId) }))

    return NextResponse.json({
      commissions: visible,
      earnings: Array.from(owed.values()),
      userId: access.userId,
      canModerate: access.canModerate,
    })
  } catch (error) {
    return failure(error, 'Failed to fetch commissions', 'Error fetching commissions')
  }
}
