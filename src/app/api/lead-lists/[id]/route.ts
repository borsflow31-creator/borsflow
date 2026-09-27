import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { canEditContent, READ_ONLY_ERROR } from '@/lib/api/workspace';

export async function GET(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const session = await getServerSession(authOptions);

        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const leadList = await prisma.leadList.findUnique({
            where: { id: params.id },
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
        });

        if (!leadList) {
            return NextResponse.json({ error: 'Lead list not found' }, { status: 404 });
        }

        // Verify user has access to the workspace
        const workspace = await prisma.workspace.findFirst({
            where: {
                id: leadList.workspaceId,
                OR: [
                    { ownerId: session.user.id },
                    { members: { some: { userId: session.user.id } } },
                ],
            },
        });

        if (!workspace) {
            return NextResponse.json({ error: 'Access denied' }, { status: 403 });
        }

        // Format leads
        const leadListWithLeads = {
            ...leadList,
            leads: leadList.leads.map(l => l.lead)
        };

        return NextResponse.json(leadListWithLeads);
    } catch (error) {
        console.error('Error fetching lead list:', error);
        return NextResponse.json(
            { error: 'Failed to fetch lead list' },
            { status: 500 }
        );
    }
}

export async function PUT(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const session = await getServerSession(authOptions);

        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { name, description, color } = body;

        // Verify user has access to the lead list's workspace
        const leadList = await prisma.leadList.findUnique({
            where: { id: params.id },
        });

        if (!leadList) {
            return NextResponse.json({ error: 'Lead list not found' }, { status: 404 });
        }

        const workspace = await prisma.workspace.findFirst({
            where: {
                id: leadList.workspaceId,
                OR: [
                    { ownerId: session.user.id },
                    { members: { some: { userId: session.user.id } } },
                ],
            },
        });

        if (!workspace) {
            return NextResponse.json({ error: 'Access denied' }, { status: 403 });
        }

        // Membership is not enough to change content: viewers are read-only.
        if (!(await canEditContent(workspace.id, session.user.id))) {
            return NextResponse.json({ error: READ_ONLY_ERROR }, { status: 403 });
        }

        // Update lead list
        const updatedLeadList = await prisma.leadList.update({
            where: { id: params.id },
            data: {
                ...(name !== undefined && { name }),
                ...(description !== undefined && { description }),
                ...(color !== undefined && { color }),
            },
        });

        return NextResponse.json(updatedLeadList);
    } catch (error) {
        console.error('Error updating lead list:', error);
        return NextResponse.json(
            { error: 'Failed to update lead list' },
            { status: 500 }
        );
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const session = await getServerSession(authOptions);

        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Verify user has access to the lead list's workspace
        const leadList = await prisma.leadList.findUnique({
            where: { id: params.id },
        });

        if (!leadList) {
            return NextResponse.json({ error: 'Lead list not found' }, { status: 404 });
        }

        const workspace = await prisma.workspace.findFirst({
            where: {
                id: leadList.workspaceId,
                OR: [
                    { ownerId: session.user.id },
                    { members: { some: { userId: session.user.id } } },
                ],
            },
        });

        if (!workspace) {
            return NextResponse.json({ error: 'Access denied' }, { status: 403 });
        }

        // Membership is not enough to change content: viewers are read-only.
        if (!(await canEditContent(workspace.id, session.user.id))) {
            return NextResponse.json({ error: READ_ONLY_ERROR }, { status: 403 });
        }

        // Delete lead list (this will cascade delete lead list associations)
        await prisma.leadList.delete({
            where: { id: params.id },
        });

        return NextResponse.json({ message: 'Lead list deleted successfully' });
    } catch (error) {
        console.error('Error deleting lead list:', error);
        return NextResponse.json(
            { error: 'Failed to delete lead list' },
            { status: 500 }
        );
    }
}
