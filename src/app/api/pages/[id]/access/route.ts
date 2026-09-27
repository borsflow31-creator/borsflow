import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { isWorkspaceAdmin } from '@/lib/workspace'

export async function GET(
    request: Request,
    { params }: { params: { id: string } }
) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const page = await prisma.page.findUnique({
            where: { id: params.id },
            select: { workspaceId: true },
        })

        if (!page) {
            return NextResponse.json({ error: 'Page not found' }, { status: 404 })
        }

        const admin = await isWorkspaceAdmin(page.workspaceId, session.user.id)
        if (!admin) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        const accesses = await prisma.pageAccess.findMany({
            where: { pageId: params.id },
            include: {
                user: { select: { id: true, name: true, email: true } },
            },
        })

        return NextResponse.json({
            accesses: accesses.map((a) => ({
                userId: a.userId,
                name: a.user.name,
                email: a.user.email,
                level: a.level,
                grantedBy: a.grantedBy,
            })),
        })
    } catch (error) {
        console.error('Error fetching page access:', error)
        return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
    }
}

export async function POST(
    request: Request,
    { params }: { params: { id: string } }
) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const page = await prisma.page.findUnique({
            where: { id: params.id },
            select: { workspaceId: true },
        })

        if (!page) {
            return NextResponse.json({ error: 'Page not found' }, { status: 404 })
        }

        const admin = await isWorkspaceAdmin(page.workspaceId, session.user.id)
        if (!admin) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        const body = await request.json()
        const { userId, level, cascade } = body

        if (!userId || !level || !['VIEW', 'EDIT', 'NONE'].includes(level)) {
            return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
        }

        // Verify target user is a workspace member
        const isMember = await prisma.workspaceMember.findFirst({
            where: { workspaceId: page.workspaceId, userId },
        })
        if (!isMember) {
            return NextResponse.json({ error: 'User is not a workspace member' }, { status: 400 })
        }

        await prisma.$transaction(async (tx) => {
            await upsertAccess(tx, params.id, userId, level, session.user.id)

            if (cascade) {
                await cascadeAccess(tx, params.id, userId, level, session.user.id)
            }
        })

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('Error updating page access:', error)
        return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
    }
}

async function upsertAccess(
    tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
    pageId: string,
    userId: string,
    level: string,
    grantedBy: string
) {
    if (level === 'NONE') {
        await tx.pageAccess.deleteMany({ where: { pageId, userId } })
    } else {
        await tx.pageAccess.upsert({
            where: { pageId_userId: { pageId, userId } },
            create: { pageId, userId, level, grantedBy },
            update: { level, grantedBy },
        })
    }
}

async function cascadeAccess(
    tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
    pageId: string,
    userId: string,
    level: string,
    grantedBy: string
) {
    const children = await tx.page.findMany({
        where: { parentId: pageId },
        select: { id: true },
    })
    for (const child of children) {
        await upsertAccess(tx, child.id, userId, level, grantedBy)
        await cascadeAccess(tx, child.id, userId, level, grantedBy)
    }
}
