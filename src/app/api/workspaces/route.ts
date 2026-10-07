import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ensureDefaultPipelines, ensureDeveloperPipeline } from '@/lib/services/pipelines'

export async function GET(request: Request) {
    try {
        const session = await getServerSession(authOptions)

        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const workspaces = await prisma.workspace.findMany({
            where: {
                OR: [
                    { ownerId: session.user.id },
                    {
                        members: {
                            some: {
                                userId: session.user.id,
                            },
                        },
                    },
                ],
            },
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
                _count: {
                    select: {
                        pages: true,
                    },
                },
            },
            orderBy: {
                updatedAt: 'desc',
            },
        })

        return NextResponse.json({ workspaces })
    } catch (error) {
        console.error('Error fetching workspaces:', error)
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
        const { name, description, icon } = body

        if (!name) {
            return NextResponse.json(
                { error: 'Name is required' },
                { status: 400 }
            )
        }

        const workspace = await prisma.workspace.create({
            data: {
                name,
                description: description || null,
                icon: icon || null,
                ownerId: session.user.id,
            },
            include: {
                owner: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                    },
                },
            },
        })

        // Every workspace is a real-estate agency: it starts with the contacts,
        // buyer and owner boards rather than an empty CRM.
        await ensureDefaultPipelines(workspace.id)

        // A developer sells units off a different funnel, so their workspaces also
        // get the buyer-sales board. Read from the session, which the business-type
        // choice refreshes, so it applies from the first workspace made after it.
        if (session.user.businessType === 'DEVELOPER') {
            await ensureDeveloperPipeline(workspace.id)
        }

        return NextResponse.json({ workspace }, { status: 201 })
    } catch (error) {
        console.error('Error creating workspace:', error)
        return NextResponse.json(
            { error: 'Something went wrong' },
            { status: 500 }
        )
    }
}
