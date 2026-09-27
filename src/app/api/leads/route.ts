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

        // Lead lists must belong to the same workspace as the pipeline
        if (Array.isArray(leadListIds) && leadListIds.length > 0) {
            const uniqueListIds: string[] = Array.from(new Set(leadListIds as string[]));
            const validLists = await prisma.leadList.count({
                where: { id: { in: uniqueListIds }, workspaceId: pipeline.workspaceId },
            });
            if (validLists !== uniqueListIds.length) {
                return NextResponse.json({ error: 'Invalid lead list' }, { status: 400 });
            }
        }

        const parsedValue = value === undefined || value === null || value === ''
            ? null
            : parseFloat(String(value));

        if (parsedValue !== null && isNaN(parsedValue)) {
            return NextResponse.json({ error: 'Invalid value' }, { status: 400 });
        }

        // Default to the pipeline's first stage. The old default was a lowercase
        // "new", which matches no column on a default pipeline ("New"), so the lead
        // was saved but never shown on the board.
        let firstStage = 'new';
        try {
            const parsed = JSON.parse(pipeline.stages);
            if (Array.isArray(parsed) && typeof parsed[0] === 'string') firstStage = parsed[0];
        } catch {
            // keep the fallback
        }

        // Get the highest order for this pipeline
        const highestOrder = await prisma.lead.findFirst({
            where: { pipelineId },
            orderBy: { order: 'desc' },
            select: { order: true },
        });

        const newOrder = (highestOrder?.order ?? 0) + 1;

        // Create new lead
        const lead = await prisma.lead.create({
            data: {
                firstName,
                lastName,
                email,
                phone,
                company,
                position,
                status: status || 'new',
                stage: stage || firstStage,
                value: parsedValue,
                source,
                notes,
                tags: Array.isArray(tags) && tags.length > 0 ? JSON.stringify(tags) : null,
                pipelineId,
                order: newOrder,
            },
        });

        // Add lead to lead lists if provided
        if (leadListIds && leadListIds.length > 0) {
            await prisma.leadListLead.createMany({
                data: leadListIds.map((leadListId: string) => ({
                    leadId: lead.id,
                    leadListId
                }))
            });
        }

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
        console.error('Error creating lead:', error);
        return NextResponse.json(
            { error: 'Failed to create lead' },
            { status: 500 }
        );
    }
}
