import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getUserPageAccess } from '@/lib/workspace'

/**
 * Page-level access, the same rule GET/PATCH /api/pages/[id] apply.
 *
 * This route used to check only workspace membership, so a member without a
 * grant on a page could read its blocks here even though the page itself was
 * refused, and a viewer could add blocks to any page.
 */
async function pageAccess(pageId: string) {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return { error: 'Unauthorized', status: 401 as const }

    const page = await prisma.page.findUnique({
        where: { id: pageId },
        select: { workspaceId: true },
    })
    if (!page) return { error: 'Page not found', status: 404 as const }

    const level = await getUserPageAccess(pageId, session.user.id, page.workspaceId)
    return { level }
}

export async function GET(
    request: Request,
    { params }: { params: { id: string } }
) {
    try {
        const access = await pageAccess(params.id)
        if ('error' in access) {
            return NextResponse.json({ error: access.error }, { status: access.status })
        }
        if (access.level === 'NONE') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        const blocks = await prisma.block.findMany({
            where: { pageId: params.id },
            orderBy: { order: 'asc' },
        })

        return NextResponse.json({ blocks })
    } catch (error) {
        console.error('Error fetching blocks:', error)
        return NextResponse.json(
            { error: 'Something went wrong' },
            { status: 500 }
        )
    }
}

export async function POST(
    request: Request,
    { params }: { params: { id: string } }
) {
    try {
        const access = await pageAccess(params.id)
        if ('error' in access) {
            return NextResponse.json({ error: access.error }, { status: access.status })
        }
        // Writing needs EDIT on the page (or workspace admin), like PATCH does.
        if (access.level === 'NONE' || access.level === 'VIEW') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        const body = await request.json()
        const { type, content } = body

        if (!type) {
            return NextResponse.json(
                { error: 'Block type is required' },
                { status: 400 }
            )
        }

        // Get the maximum order for blocks in this page
        const maxOrder = await prisma.block.findFirst({
            where: { pageId: params.id },
            orderBy: { order: 'desc' },
            select: { order: true },
        })

        const block = await prisma.block.create({
            data: {
                pageId: params.id,
                type,
                content: JSON.stringify(content || {}),
                order: (maxOrder?.order || 0) + 1,
            },
        })

        return NextResponse.json({ block }, { status: 201 })
    } catch (error) {
        console.error('Error creating block:', error)
        return NextResponse.json(
            { error: 'Something went wrong' },
            { status: 500 }
        )
    }
}
