import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { canEditContent, READ_ONLY_ERROR } from '@/lib/api/workspace';

export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);

        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const workspaceId = searchParams.get('workspaceId');

        if (!workspaceId) {
            return NextResponse.json({ error: 'Workspace ID is required' }, { status: 400 });
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

        // Fetch all lead lists for the workspace
        const leadLists = await prisma.leadList.findMany({
            where: { workspaceId },
            include: {
                leads: {
                    include: {
                        lead: true
                    }
                },
                _count: {
                    select: { leads: true }
                }
            },
            orderBy: { order: 'asc' },
        });

        // Format leads
        const leadListsWithLeads = leadLists.map(leadList => ({
            ...leadList,
            leads: leadList.leads.map(l => l.lead)
        }));

        return NextResponse.json(leadListsWithLeads);
    } catch (error) {
        console.error('Error fetching lead lists:', error);
        return NextResponse.json(
            { error: 'Failed to fetch lead lists' },
            { status: 500 }
        );
    }
}

export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);

        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { name, description, color, workspaceId } = body;

        if (!name || !workspaceId) {
            return NextResponse.json(
                { error: 'Name and workspace ID are required' },
                { status: 400 }
            );
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

        // Get the highest order for this workspace
        const highestOrder = await prisma.leadList.findFirst({
            where: { workspaceId },
            orderBy: { order: 'desc' },
            select: { order: true },
        });

        const newOrder = (highestOrder?.order ?? 0) + 1;

        // Create new lead list
        const leadList = await prisma.leadList.create({
            data: {
                name,
                description,
                color,
                workspaceId,
                order: newOrder,
            },
        });

        return NextResponse.json(leadList, { status: 201 });
    } catch (error) {
        console.error('Error creating lead list:', error);
        return NextResponse.json(
            { error: 'Failed to create lead list' },
            { status: 500 }
        );
    }
}
