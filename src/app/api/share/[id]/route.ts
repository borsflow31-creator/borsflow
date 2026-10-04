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

        // Block.content is stored as a JSON string; the read-only renderer expects objects.
        const blocks = page.blocks.map((b) => {
            try {
                return { ...b, content: typeof b.content === 'string' ? JSON.parse(b.content) : b.content }
            } catch {
                return { ...b, content: {} }
            }
        })

        return NextResponse.json({ page: { ...page, blocks } })
    } catch (error) {
        console.error('Error fetching shared page:', error)
        return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
    }
}
