import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getUserPageAccess } from '@/lib/workspace'

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
            include: {
                workspace: {
                    select: {
                        id: true,
                        name: true,
                        ownerId: true,
                    },
                },
                parent: {
                    select: {
                        id: true,
                        title: true,
                    },
                },
                children: {
                    orderBy: { order: 'asc' },
                },
                blocks: {
                    orderBy: { order: 'asc' },
                },
            },
        })

        if (!page) {
            return NextResponse.json({ error: 'Page not found' }, { status: 404 })
        }

        const accessLevel = await getUserPageAccess(params.id, session.user.id, page.workspaceId)
        if (accessLevel === 'NONE') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        return NextResponse.json({ page, accessLevel })
    } catch (error) {
        console.error('Error fetching page:', error)
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

        const page = await prisma.page.findUnique({
            where: { id: params.id },
            include: {
                workspace: true,
            },
        })

        if (!page) {
            return NextResponse.json({ error: 'Page not found' }, { status: 404 })
        }

        const accessLevel = await getUserPageAccess(params.id, session.user.id, page.workspaceId)
        if (accessLevel === 'NONE' || accessLevel === 'VIEW') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        const body = await request.json()
        const { title, content, icon, coverImage, order, isPublic } = body

        // Extract blocks array from content payload so we can sync the Block table
        const blocksPayload: { id?: string; type: string; content: any; order: number }[] | undefined =
            content?.blocks ?? undefined

        const updatedPage = await prisma.$transaction(async (tx) => {
            const page = await tx.page.update({
                where: { id: params.id },
                data: {
                    ...(title !== undefined && { title }),
                    ...(content !== undefined && { content: typeof content === 'string' ? content : JSON.stringify(content) }),
                    ...(icon !== undefined && { icon }),
                    ...(coverImage !== undefined && { coverImage }),
                    ...(order !== undefined && { order }),
                    ...(isPublic !== undefined && { isPublic }),
                },
            })

            // Sync blocks into the Block relation table when a blocks array is provided.
            //
            // Block ids are preserved rather than regenerated: Comment.blockId points at
            // them with ON DELETE SET NULL, so deleting and recreating every block on each
            // save would detach every anchored comment.
            if (blocksPayload !== undefined) {
                const existing = await tx.block.findMany({
                    where: { pageId: params.id },
                    select: { id: true },
                })
                const existingIds = new Set(existing.map((b: { id: string }) => b.id))

                const keptIds = new Set(
                    blocksPayload
                        .map((b) => b.id)
                        .filter((id): id is string => typeof id === 'string' && existingIds.has(id))
                )

                const removedIds = [...existingIds].filter((id) => !keptIds.has(id))
                if (removedIds.length > 0) {
                    await tx.block.deleteMany({ where: { id: { in: removedIds } } })
                }

                for (const [i, block] of blocksPayload.entries()) {
                    const serialized =
                        typeof block.content === 'string' ? block.content : JSON.stringify(block.content)

                    if (block.id && keptIds.has(block.id)) {
                        await tx.block.update({
                            where: { id: block.id },
                            data: { type: block.type, content: serialized, order: i },
                        })
                    } else {
                        await tx.block.create({
                            data: {
                                // Reuse the client-generated id when it is free, so the id the
                                // editor holds keeps matching the row after the save.
                                ...(block.id && !existingIds.has(block.id) ? { id: block.id } : {}),
                                pageId: params.id,
                                type: block.type,
                                content: serialized,
                                order: i,
                            },
                        })
                    }
                }
            }

            return page
        })

        return NextResponse.json({ page: updatedPage })
    } catch (error) {
        console.error('Error updating page:', error)
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

        const page = await prisma.page.findUnique({
            where: { id: params.id },
            include: {
                workspace: true,
            },
        })

        if (!page) {
            return NextResponse.json({ error: 'Page not found' }, { status: 404 })
        }

        const accessLevel = await getUserPageAccess(params.id, session.user.id, page.workspaceId)
        if (accessLevel !== 'ADMIN') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        await prisma.page.delete({
            where: { id: params.id },
        })

        return NextResponse.json({ message: 'Page deleted successfully' })
    } catch (error) {
        console.error('Error deleting page:', error)
        return NextResponse.json(
            { error: 'Something went wrong' },
            { status: 500 }
        )
    }
}
