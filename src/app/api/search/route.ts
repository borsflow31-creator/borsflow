export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { buildPageAccessWhere } from '@/lib/workspace'

export async function GET(request: Request) {
    try {
        const session = await getServerSession(authOptions)

        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { searchParams } = new URL(request.url)
        const query = searchParams.get('q')
        const workspaceId = searchParams.get('workspaceId')

        if (!query) {
            return NextResponse.json(
                { error: 'Search query is required' },
                { status: 400 }
            )
        }

        // Only pages this user may open: owners/admins see their whole workspace,
        // members and viewers only pages they hold a grant for. Searching by
        // workspace membership alone returned the titles of restricted pages.
        const accessWhere = await buildPageAccessWhere(session.user.id, workspaceId)

        // Search pages (case-insensitive: "roadmap" should find "Roadmap")
        const pages = await prisma.page.findMany({
            where: {
                AND: [
                    accessWhere,
                    {
                        OR: [
                            { title: { contains: query, mode: 'insensitive' } },
                            { content: { contains: query, mode: 'insensitive' } },
                        ],
                    },
                ],
            },
            include: {
                workspace: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
            },
            orderBy: {
                updatedAt: 'desc',
            },
            take: 20,
        })

        return NextResponse.json({
            results: pages.map((page: any) => ({
                id: page.id,
                title: page.title,
                type: 'page',
                workspaceId: page.workspaceId,
                workspaceName: page.workspace.name,
                updatedAt: page.updatedAt,
            })),
        })
    } catch (error) {
        console.error('Error searching:', error)
        return NextResponse.json(
            { error: 'Something went wrong' },
            { status: 500 }
        )
    }
}
