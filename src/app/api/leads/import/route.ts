import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { canEditContent, READ_ONLY_ERROR } from '@/lib/api/workspace';

interface LeadRow {
    firstName: string;
    lastName: string;
    email?: string;
    phone?: string;
    company?: string;
    position?: string;
    status?: string;
    stage?: string;
    value?: string;
    source?: string;
    notes?: string;
    tags?: string;
}

const VALID_STATUSES = ['new', 'contacted', 'qualified', 'proposal', 'negotiation', 'won', 'lost'];

export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);

        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { pipelineId, leads } = body as { pipelineId: string; leads: LeadRow[] };

        if (!pipelineId || !Array.isArray(leads) || leads.length === 0) {
            return NextResponse.json(
                { error: 'Pipeline ID and leads array are required' },
                { status: 400 }
            );
        }

        if (leads.length > 1000) {
            return NextResponse.json(
                { error: 'Maximum 1000 leads per import' },
                { status: 400 }
            );
        }

        // Verify access
        const pipeline = await prisma.pipeline.findUnique({ where: { id: pipelineId } });
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

        // Get starting order
        const highestOrder = await prisma.lead.findFirst({
            where: { pipelineId },
            orderBy: { order: 'desc' },
            select: { order: true },
        });
        let nextOrder = (highestOrder?.order ?? 0) + 1;

        let pipelineStages: string[] = [];
        try {
            const parsed = JSON.parse(pipeline.stages as unknown as string);
            if (Array.isArray(parsed)) pipelineStages = parsed;
        } catch {
            pipelineStages = [];
        }
        const defaultStage = pipelineStages[0] ?? 'new';

        const results = { created: 0, skipped: 0, stageCoerced: 0, errors: [] as string[] };
        const createdIds: string[] = [];

        for (const row of leads) {
            if (!row.firstName?.trim() || !row.lastName?.trim()) {
                results.skipped++;
                continue;
            }

            try {
                const status = row.status && VALID_STATUSES.includes(row.status.toLowerCase())
                    ? row.status.toLowerCase()
                    : 'new';

                // Only accept a stage that exists on this pipeline (case-insensitive);
                // otherwise the lead would render in no column.
                const requestedStage = row.stage?.trim();
                const matchedStage = requestedStage
                    ? pipelineStages.find(s => s.toLowerCase() === requestedStage.toLowerCase())
                    : undefined;
                const stage = matchedStage ?? defaultStage;
                if (requestedStage && !matchedStage) results.stageCoerced++;

                const parsedValue = row.value ? parseFloat(String(row.value).replace(/[^0-9.]/g, '')) : null;
                const tags = row.tags
                    ? row.tags.split(',').map((t: string) => t.trim()).filter(Boolean)
                    : [];

                const created = await prisma.lead.create({
                    data: {
                        firstName: row.firstName.trim().slice(0, 50),
                        lastName: row.lastName.trim().slice(0, 50),
                        email: row.email?.trim().slice(0, 255) || null,
                        phone: row.phone?.trim().slice(0, 50) || null,
                        company: row.company?.trim().slice(0, 100) || null,
                        position: row.position?.trim().slice(0, 100) || null,
                        status,
                        stage,
                        value: parsedValue && !isNaN(parsedValue) ? parsedValue : null,
                        source: row.source?.trim().slice(0, 100) || null,
                        notes: row.notes?.trim().slice(0, 2000) || null,
                        tags: tags.length > 0 ? JSON.stringify(tags) : null,
                        pipelineId,
                        order: nextOrder++,
                    },
                    select: { id: true },
                });
                createdIds.push(created.id);

                results.created++;
            } catch (err) {
                results.errors.push(`Row ${results.created + results.skipped + 1}: ${err instanceof Error ? err.message : 'Unknown error'}`);
                results.skipped++;
            }
        }

        // One "added by import" entry in each new prospect's history, written in a single query
        if (createdIds.length > 0) {
            await prisma.activity.createMany({
                data: createdIds.map((leadId) => ({
                    workspaceId: workspace.id,
                    userId: session.user.id,
                    type: 'lead_created',
                    entityType: 'lead',
                    entityId: leadId,
                    leadId,
                    description: 'Added by spreadsheet import',
                    metadata: JSON.stringify({ via: 'import' }),
                })),
            }).catch((err) => console.error('Failed to log imported leads:', err));
        }

        return NextResponse.json(results, { status: 201 });
    } catch (error) {
        console.error('Error importing leads:', error);
        return NextResponse.json({ error: 'Failed to import leads' }, { status: 500 });
    }
}
