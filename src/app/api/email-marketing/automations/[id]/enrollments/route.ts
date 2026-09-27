import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireWorkspaceAccess } from '@/lib/api/workspace'

// GET /api/email-marketing/automations/[id]/enrollments?status=&limit=
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const automation = await prisma.emailAutomation.findUnique({
      where: { id: params.id },
      select: { id: true, workspaceId: true },
    })

    if (!automation) {
      return NextResponse.json({ error: 'Automation not found' }, { status: 404 })
    }

    const access = await requireWorkspaceAccess(automation.workspaceId)
    if ('error' in access) {
      return NextResponse.json({ error: access.error }, { status: access.status })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const limitParam = parseInt(searchParams.get('limit') || '50', 10)
    const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 200) : 50

    const [enrollments, counts] = await Promise.all([
      prisma.automationEnrollment.findMany({
        where: {
          automationId: params.id,
          ...(status ? { status } : {}),
        },
        include: {
          lead: {
            select: { id: true, firstName: true, lastName: true, email: true, stage: true },
          },
        },
        orderBy: { enrolledAt: 'desc' },
        take: limit,
      }),
      prisma.automationEnrollment.groupBy({
        by: ['status'],
        where: { automationId: params.id },
        _count: { _all: true },
      }),
    ])

    return NextResponse.json({
      enrollments: enrollments.map(e => ({
        ...e,
        triggerContext: e.triggerContext ? safeParse(e.triggerContext) : null,
      })),
      counts: Object.fromEntries(counts.map(c => [c.status, c._count._all])),
    })
  } catch (error) {
    console.error('Error fetching enrollments:', error)
    return NextResponse.json({ error: 'Failed to fetch enrollments' }, { status: 500 })
  }
}

function safeParse(raw: string) {
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}
