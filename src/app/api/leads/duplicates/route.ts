import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { Prisma } from '@prisma/client';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { normalizeEmail, normalizePhone } from '@/lib/crm/contact-match';

/**
 * GET /api/leads/duplicates?workspaceId=...&email=...&phone=...
 *
 * Leads in the workspace that already have this email or this phone number,
 * for the new-lead form to warn before a second record is made. Matches on
 * contact details only: two people can share a name, not a phone number.
 * Phones are compared with separators stripped, as stored numbers were typed
 * in whatever format the person used.
 */
export async function GET(request: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get('workspaceId');
    if (!workspaceId) return NextResponse.json({ error: 'workspaceId required' }, { status: 400 });

    const workspace = await prisma.workspace.findFirst({
        where: {
            id: workspaceId,
            OR: [
                { ownerId: session.user.id },
                { members: { some: { userId: session.user.id } } },
            ],
        },
        select: { id: true },
    });
    if (!workspace) return NextResponse.json({ error: 'Access denied' }, { status: 403 });

    const email = normalizeEmail(searchParams.get('email'));
    const phone = normalizePhone(searchParams.get('phone'));
    if (!email && !phone) return NextResponse.json({ matches: [] });

    try {
        const ids = new Set<string>();
        if (email) {
            const byEmail = await prisma.lead.findMany({
                where: { pipeline: { workspaceId }, email: { equals: email, mode: 'insensitive' } },
                select: { id: true },
                take: 5,
            });
            byEmail.forEach(l => ids.add(l.id));
        }
        if (phone) {
            // "00" and "+" are the same prefix; anything else must match digit for digit.
            const byPhone = await prisma.$queryRaw<{ id: string }[]>(Prisma.sql`
                SELECT l."id" FROM "public"."Lead" l
                JOIN "public"."Pipeline" p ON p."id" = l."pipelineId"
                WHERE p."workspaceId" = ${workspaceId}
                  AND l."phone" IS NOT NULL
                  AND regexp_replace(regexp_replace(l."phone", '[\\s.()/-]', '', 'g'), '^00', '+') = ${phone}
                LIMIT 5`);
            byPhone.forEach(l => ids.add(l.id));
        }
        if (ids.size === 0) return NextResponse.json({ matches: [] });

        const leads = await prisma.lead.findMany({
            where: { id: { in: Array.from(ids) } },
            select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                phone: true,
                stage: true,
                pipelineId: true,
                updatedAt: true,
                lastContactedAt: true,
                owner: { select: { name: true } },
                interestedProgram: { select: { name: true } },
            },
            orderBy: { updatedAt: 'desc' },
            take: 5,
        });
        const lastActivity = await prisma.activity.groupBy({
            by: ['leadId'],
            where: { leadId: { in: leads.map(l => l.id) } },
            _max: { createdAt: true },
        });
        const lastByLead = new Map(lastActivity.map(a => [a.leadId, a._max.createdAt]));

        return NextResponse.json({
            matches: leads.map(({ owner, interestedProgram, updatedAt, lastContactedAt, ...lead }) => ({
                ...lead,
                ownerName: owner?.name ?? null,
                programName: interestedProgram?.name ?? null,
                lastActivityAt: lastByLead.get(lead.id) ?? lastContactedAt ?? updatedAt,
                matchedOn: [
                    email && normalizeEmail(lead.email) === email ? 'email' : null,
                    phone && normalizePhone(lead.phone) === phone ? 'phone' : null,
                ].filter(Boolean),
            })),
        });
    } catch (error) {
        console.error('Error checking lead duplicates:', error);
        return NextResponse.json({ error: 'Failed to check duplicates' }, { status: 500 });
    }
}
