import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { canEditContent, READ_ONLY_ERROR } from '@/lib/api/workspace';

const VALID_STATUSES = ['todo', 'inprogress', 'done'];

export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);

        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { workspaceId, cards } = body as {
            workspaceId?: string;
            cards?: Array<{ id: string; status: string; order: number }>;
        };

        if (!workspaceId || !Array.isArray(cards) || cards.length === 0) {
            return NextResponse.json(
                { error: 'workspaceId and a non-empty cards array are required' },
                { status: 400 }
            );
        }

        for (const c of cards) {
            if (!c || typeof c.id !== 'string' || typeof c.order !== 'number' || !VALID_STATUSES.includes(c.status)) {
                return NextResponse.json({ error: 'Invalid card entry' }, { status: 400 });
            }
        }

        // Verify user has access to workspace
        const workspace = await prisma.workspace.findFirst({
            where: {
                id: workspaceId,
                OR: [
                    { ownerId: session.user.id },
                    { members: { some: { userId: session.user.id } } },
                ],
            },
        });

        if (!workspace) {
            return NextResponse.json({ error: 'Workspace not found or access denied' }, { status: 404 });
        }

        // Membership is not enough to change content: viewers are read-only.
        if (!(await canEditContent(workspace.id, session.user.id))) {
            return NextResponse.json({ error: READ_ONLY_ERROR }, { status: 403 });
        }

        // Verify every submitted card actually belongs to this workspace before writing
        const ids = cards.map((c) => c.id);
        const existing = await prisma.kanbanCard.findMany({
            where: { id: { in: ids }, workspaceId },
            select: { id: true },
        });

        if (existing.length !== ids.length) {
            return NextResponse.json(
                { error: 'One or more cards do not belong to this workspace' },
                { status: 400 }
            );
        }

        await prisma.$transaction(
            cards.map((c) =>
                prisma.kanbanCard.update({
                    where: { id: c.id },
                    data: { status: c.status, order: c.order },
                })
            )
        );

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error reordering kanban cards:', error);
        return NextResponse.json(
            { error: 'Failed to reorder kanban cards' },
            { status: 500 }
        );
    }
}
