import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { canEditContent, READ_ONLY_ERROR } from '@/lib/api/workspace';
import { createLead } from '@/lib/services/leads';
import { ServiceError } from '@/lib/services/errors';

export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);

        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const pipelineId = searchParams.get('pipelineId');
        const workspaceId = searchParams.get('workspaceId');
        const leadListId = searchParams.get('leadListId');
        const status = searchParams.get('status');
        const stage = searchParams.get('stage');
        const limit = searchParams.get('limit');

        // Workspace-level query (used by quote/invoice contact picker)
        if (workspaceId && !pipelineId) {
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
                return NextResponse.json({ error: 'Access denied' }, { status: 403 });
            }

            const leads = await prisma.lead.findMany({
                where: { pipeline: { workspaceId } },
                select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    email: true,
                    phone: true,
                    company: true,
                },
                orderBy: { firstName: 'asc' },
                ...(limit ? { take: parseInt(limit, 10) } : {}),
            });

            return NextResponse.json({ leads });
        }

        if (!pipelineId) {
            return NextResponse.json({ error: 'Pipeline ID is required' }, { status: 400 });
        }

        // Verify user has access to the pipeline's workspace
        const pipeline = await prisma.pipeline.findUnique({
            where: { id: pipelineId },
        });

        if (!pipeline) {
            return NextResponse.json({ error: 'Pipeline not found' }, { status: 404 });
        }

        const workspace = await prisma.workspace.findFirst({
            where: {
                id: pipeline.workspaceId,
                OR: [
                    { ownerId: session.user.id },
                    { members: { some: { userId: session.user.id } } },
                ],
            },
        });

        if (!workspace) {
            return NextResponse.json({ error: 'Access denied' }, { status: 403 });
        }

        // Build where clause
        const where: any = { pipelineId };
        if (status) where.status = status;
        if (stage) where.stage = stage;

        // Fetch leads
        const leads = await prisma.lead.findMany({
            where,
            include: {
                leadLists: {
                    include: {
                        leadList: true
                    }
                }
            },
            orderBy: { order: 'asc' },
        });

        // Parse tags JSON and format lead lists
        const leadsWithParsedData = leads.map(lead => ({
            ...lead,
            tags: lead.tags ? JSON.parse(lead.tags) : [],
            leadLists: lead.leadLists.map(l => l.leadList)
        }));

        return NextResponse.json(leadsWithParsedData);
    } catch (error) {
        console.error('Error fetching leads:', error);
        return NextResponse.json(
            { error: 'Failed to fetch leads' },
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
        const {
            firstName,
            lastName,
            email,
            phone,
            company,
            position,
            status,
            stage,
            value,
            source,
            notes,
            tags,
            pipelineId,
            leadListIds
        } = body;

        if (!firstName || !lastName || !pipelineId) {
            return NextResponse.json(
                { error: 'First name, last name, and pipeline ID are required' },
                { status: 400 }
            );
        }

        // Verify user has access to the pipeline's workspace
        const pipeline = await prisma.pipeline.findUnique({
            where: { id: pipelineId },
        });

        if (!pipeline) {
            return NextResponse.json({ error: 'Pipeline not found' }, { status: 404 });
        }

        const workspace = await prisma.workspace.findFirst({
            where: {
                id: pipeline.workspaceId,
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

        const lead = await createLead(pipeline, {
            firstName,
            lastName,
            email,
            phone,
            company,
            position,
            status,
            stage,
            value,
            source,
            notes,
            tags,
            leadListIds,
        });

        // Fetch the lead with lead lists
        const leadWithLists = await prisma.lead.findUnique({
            where: { id: lead.id },
            include: {
                leadLists: {
                    include: {
                        leadList: true
                    }
                }
            }
        });

        // Parse tags JSON and format lead lists
        const leadWithParsedData = {
            ...leadWithLists,
            tags: leadWithLists?.tags ? JSON.parse(leadWithLists.tags) : [],
            leadLists: leadWithLists?.leadLists.map(l => l.leadList) || []
        };

        return NextResponse.json(leadWithParsedData, { status: 201 });
    } catch (error) {
        if (error instanceof ServiceError) {
            return NextResponse.json({ error: error.message }, { status: error.status });
        }
        console.error('Error creating lead:', error);
        return NextResponse.json(
            { error: 'Failed to create lead' },
            { status: 500 }
        );
    }
}
