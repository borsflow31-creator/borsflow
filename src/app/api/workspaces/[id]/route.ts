import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getAccessiblePageIds } from '@/lib/workspace'

export async function GET(
    request: Request,
    { params }: { params: { id: string } }
) {
    try {
        const session = await getServerSession(authOptions)

        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const workspace = await prisma.workspace.findUnique({
            where: { id: params.id },
            include: {
                owner: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                    },
                },
                members: {
                    include: {
                        user: {
                            select: {
                                id: true,
                                name: true,
                                email: true,
                            },
                        },
                    },
                },
                pages: {
                    where: { parentId: null },
                    orderBy: { order: 'asc' },
                    include: {
                        children: {
                            orderBy: { order: 'asc' },
                            include: {
                                _count: { select: { accessRecords: true } },
                            },
                        },
                        _count: { select: { accessRecords: true } },
                    },
                },
            },
        })

        if (!workspace) {
            return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })
        }

        // Check if user has access to this workspace
        const hasAccess =
            workspace.ownerId === session.user.id ||
            workspace.members.some((member: any) => member.userId === session.user.id)

        if (!hasAccess) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        // Filter pages by what this user can access
        const accessibleIds = await getAccessiblePageIds(params.id, session.user.id)
        if (accessibleIds !== null) {
            workspace.pages = workspace.pages
                .filter((p: any) => accessibleIds.includes(p.id))
                .map((p: any) => ({
                    ...p,
                    children: p.children.filter((c: any) => accessibleIds.includes(c.id)),
                }))
        }

        return NextResponse.json({ workspace })
    } catch (error) {
        console.error('Error fetching workspace:', error)
        return NextResponse.json(
            { error: 'Something went wrong' },
            { status: 500 }
        )
    }
}

export async function PATCH(
    request: Request,
    { params }: { params: { id: string } }
) {
    try {
        const session = await getServerSession(authOptions)

        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const workspace = await prisma.workspace.findUnique({
            where: { id: params.id },
        })

        if (!workspace) {
            return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })
        }

        if (workspace.ownerId !== session.user.id) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        const body = await request.json()
        const { name, description, icon } = body

        const updatedWorkspace = await prisma.workspace.update({
            where: { id: params.id },
            data: {
                ...(name !== undefined && { name }),
                ...(description !== undefined && { description }),
                ...(icon !== undefined && { icon }),
            },
        })

        return NextResponse.json({ workspace: updatedWorkspace })
    } catch (error) {
        console.error('Error updating workspace:', error)
        return NextResponse.json(
            { error: 'Something went wrong' },
            { status: 500 }
        )
    }
}

export async function DELETE(
    request: Request,
    { params }: { params: { id: string } }
) {
    try {
        const session = await getServerSession(authOptions)

        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const workspace = await prisma.workspace.findUnique({
            where: { id: params.id },
        })

        if (!workspace) {
            return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })
        }

        if (workspace.ownerId !== session.user.id) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        await prisma.workspace.delete({
            where: { id: params.id },
        })

        return NextResponse.json({ message: 'Workspace deleted successfully' })
    } catch (error) {
        console.error('Error deleting workspace:', error)
        return NextResponse.json(
            { error: 'Something went wrong' },
            { status: 500 }
        )
    }
}
