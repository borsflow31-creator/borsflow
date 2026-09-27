import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
    request: Request,
    { params }: { params: { id: string } }
) {
    try {
        const page = await prisma.page.findUnique({
            where: { id: params.id },
            include: {
                blocks: {
                    orderBy: { order: 'asc' },
                },
                workspace: {
                    select: { id: true, name: true },
                },
            },
        })

        if (!page) {
            return NextResponse.json({ error: 'Page not found' }, { status: 404 })
        }

        if (!page.isPublic) {
            return NextResponse.json({ error: 'This page is not publicly shared' }, { status: 403 })
        }

        return NextResponse.json({ page })
    } catch (error) {
        console.error('Error fetching shared page:', error)
        return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
    }
}
