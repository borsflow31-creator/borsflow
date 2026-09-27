import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { buildPageAccessWhere, getWorkspaceMembership } from '@/lib/workspace'
import { requireWorkspacePermission } from '@/lib/api/workspace'

const DEFAULT_LIMIT = 100
const MAX_LIMIT = 200

// The list only renders a title, an icon and a date, so it selects those rather
// than the whole row — `content` holds the entire document body.
const PAGE_LIST_SELECT = {
    id: true,
    title: true,
    icon: true,
    coverImage: true,
    workspaceId: true,
    parentId: true,
    order: true,
    isPublic: true,
    createdAt: true,
    updatedAt: true,
    workspace: {
        select: {
            id: true,
            name: true,
        },
    },
} as const

export async function GET(request: Request) {
    try {
        const session = await getServerSession(authOptions)

        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { searchParams } = new URL(request.url)
        const workspaceId = searchParams.get('workspaceId')
        const parentId = searchParams.get('parentId')

        const parsedLimit = Number(searchParams.get('limit'))
        const limit = Number.isFinite(parsedLimit) && parsedLimit > 0
            ? Math.min(Math.floor(parsedLimit), MAX_LIMIT)
            : DEFAULT_LIMIT

        // `order` is the in-workspace manual ordering; `updatedAt` is what a
        // "recent activity" caller wants, and it has to be applied here because
        // `limit` truncates before the client can sort.
        const orderBy = searchParams.get('sort') === 'updatedAt'
            ? { updatedAt: 'desc' as const }
            : { order: 'asc' as const }

        // Always applied: without it an omitted workspaceId would leave the filter
        // empty and return every tenant's pages.
        const where: any = await buildPageAccessWhere(session.user.id, workspaceId)

        if (parentId === 'null') {
            where.parentId = null
        } else if (parentId) {
            where.parentId = parentId
        }

        const pages = await prisma.page.findMany({
            where,
            select: PAGE_LIST_SELECT,
            orderBy,
            take: limit,
        })

        // The list hides actions the delete endpoint would reject; it needs the
        // caller's workspace role to know which those are.
        let role: string | null = null
        if (workspaceId) {
            const workspace = await prisma.workspace.findUnique({
                where: { id: workspaceId },
                select: { ownerId: true },
            })
            if (workspace?.ownerId === session.user.id) {
                role = 'owner'
            } else {
                const membership = await getWorkspaceMembership(workspaceId, session.user.id)
                role = membership?.role ?? null
            }
        }

        return NextResponse.json({ pages, role })
    } catch (error) {
        console.error('Error fetching pages:', error)
        return NextResponse.json(
            { error: 'Something went wrong' },
            { status: 500 }
        )
    }
}

export async function POST(request: Request) {
    try {
        const session = await getServerSession(authOptions)

        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const body = await request.json()
        const { title, workspaceId, parentId, icon, coverImage } = body

        if (!title || !workspaceId) {
            return NextResponse.json(
                { error: 'Title and workspaceId are required' },
                { status: 400 }
            )
        }

        // Creating content needs more than membership: viewers are read-only.
        const access = await requireWorkspacePermission(workspaceId, 'content:create')
        if ('error' in access) {
            return NextResponse.json({ error: access.error }, { status: access.status })
        }

        // A sub-page must live in the same workspace as its parent. Otherwise a
        // page from one workspace could be attached under another workspace's
        // page and show up in that workspace's sidebar.
        if (parentId) {
            const parent = await prisma.page.findFirst({
                where: { id: parentId, workspaceId },
                select: { id: true },
            })
            if (!parent) {
                return NextResponse.json({ error: 'Parent page not found in this workspace' }, { status: 400 })
            }
        }

        // Get the maximum order for pages in this workspace/parent
        const maxOrder = await prisma.page.findFirst({
            where: {
                workspaceId,
                parentId: parentId || null,
            },
            orderBy: {
                order: 'desc',
            },
            select: {
                order: true,
            },
        })

        const page = await prisma.page.create({
            data: {
                title,
                workspaceId,
                parentId: parentId || null,
                icon: icon || null,
                coverImage: coverImage || null,
                createdById: session.user.id,
                order: (maxOrder?.order || 0) + 1,
                content: JSON.stringify({
                    type: 'doc',
                    content: [],
                }),
            },
        })

        // Members only see pages they hold a grant for, and nothing granted one to
        // the creator, so a member could not open the page they had just made.
        // Owners and admins see every page and need no grant.
        if (access.role === 'member') {
            await prisma.pageAccess.create({
                data: { pageId: page.id, userId: session.user.id, level: 'EDIT', grantedBy: session.user.id },
            })
        }

        return NextResponse.json({ page }, { status: 201 })
    } catch (error) {
        console.error('Error creating page:', error)
        return NextResponse.json(
            { error: 'Something went wrong' },
            { status: 500 }
        )
    }
}
