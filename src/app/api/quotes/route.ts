import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { canEditContent, READ_ONLY_ERROR } from '@/lib/api/workspace';
import { calculateDocumentTotals, buildItemCreateData } from '@/lib/documents/calculations';
import { createWithDocumentNumber } from '@/lib/documents/numbering';
import { parsePagination, parseSort, buildClientSearchFilter } from '@/lib/documents/query';

// GET /api/quotes - List quotes
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get('workspaceId');
    const status = searchParams.get('status');
    const leadId = searchParams.get('leadId');
    const search = searchParams.get('search');
    const { page, limit, skip, take } = parsePagination(searchParams);
    const orderBy = parseSort(searchParams.get('sortBy'));

    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace ID is required' }, { status: 400 });
    }

    // Check if user has access to workspace
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

    // Build where clause
    const where: any = { workspaceId };
    
    if (status) {
      where.status = status;
    }
    
    if (leadId) {
      where.leadId = leadId;
    }
    
    if (search) {
      where.OR = buildClientSearchFilter(search);
    }

    // Get total count
    const total = await prisma.quote.count({ where: where });

    // Get quotes with pagination
    const quotes = await prisma.quote.findMany({
      where: where,
      include: {
        items: { orderBy: { order: 'asc' } },
        lead: { select: { id: true, firstName: true, lastName: true } }
      },
      orderBy,
      skip,
      take
    });

    return NextResponse.json({
      quotes,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching quotes:', error);
    return NextResponse.json(
      { error: 'Failed to fetch quotes' },
      { status: 500 }
    );
  }
}

// POST /api/quotes - Create quote
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      workspaceId,
      leadId,
      clientName,
      clientEmail,
      clientPhone,
      clientCompany,
      clientAddress,
      issueDate,
      validUntil,
      currency,
      taxRate,
      discountType,
      discountValue,
      notes,
      terms,
      internalNotes,
      items
    } = body;

    // Validate required fields
    if (!workspaceId || !clientName) {
      return NextResponse.json(
        { error: 'Workspace ID and client name are required' },
        { status: 400 }
      );
    }

    if (items !== undefined && !Array.isArray(items)) {
      return NextResponse.json({ error: 'Items must be an array' }, { status: 400 });
    }

    // Check if user has access to workspace
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

    // Membership is not enough to change content: viewers are read-only.
    if (!(await canEditContent(workspace.id, session.user.id))) {
      return NextResponse.json({ error: READ_ONLY_ERROR }, { status: 403 });
    }

    // Client details default to the request body and are overridden by the lead
    // when one is linked. These used to be assigned back onto `body`, which the
    // create call below never read, so linking a lead pre-filled nothing.
    let resolvedClientName = clientName;
    let resolvedClientEmail = clientEmail;
    let resolvedClientPhone = clientPhone;
    let resolvedClientCompany = clientCompany;

    // If leadId is provided, verify it exists and belongs to the workspace
    if (leadId) {
      const lead = await prisma.lead.findUnique({
        where: { id: leadId },
        include: { pipeline: true }
      });

      if (!lead) {
        return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
      }

      // Get workspace from lead's pipeline
      const pipelineWorkspace = await prisma.pipeline.findUnique({
        where: { id: lead.pipelineId },
        select: { workspaceId: true }
      });

      if (pipelineWorkspace?.workspaceId !== workspaceId) {
        return NextResponse.json(
          { error: 'Lead does not belong to this workspace' },
          { status: 400 }
        );
      }

      // Pre-fill client information from lead
      resolvedClientName = `${lead.firstName} ${lead.lastName}`;
      resolvedClientEmail = lead.email || null;
      resolvedClientPhone = lead.phone || null;
      resolvedClientCompany = lead.company || null;
    }

    const totals = calculateDocumentTotals(items, { taxRate, discountType, discountValue });

    const quote = await createWithDocumentNumber('quote', workspaceId, (quoteNumber) =>
      prisma.quote.create({
        data: {
          quoteNumber,
          workspaceId,
          leadId: leadId || null,
          clientName: resolvedClientName,
          clientEmail: resolvedClientEmail || null,
          clientPhone: resolvedClientPhone || null,
          clientCompany: resolvedClientCompany || null,
          clientAddress: clientAddress || null,
          status: 'draft',
          issueDate: issueDate ? new Date(issueDate) : new Date(),
          validUntil: validUntil ? new Date(validUntil) : null,
          currency: currency || 'USD',
          subtotal: totals.subtotal,
          taxRate: taxRate || 0,
          taxAmount: totals.taxAmount,
          discountType: discountType && discountType !== 'none' ? discountType : null,
          discountValue: discountValue || 0,
          discountAmount: totals.discountAmount,
          total: totals.total,
          notes: notes || null,
          terms: terms || null,
          internalNotes: internalNotes || null,
          createdById: session.user.id,
          items: { create: buildItemCreateData(items) },
        },
        include: {
          items: { orderBy: { order: 'asc' } },
          lead: { select: { id: true, firstName: true, lastName: true } },
        },
      })
    );

    return NextResponse.json({ quote }, { status: 201 });
  } catch (error) {
    console.error('Error creating quote:', error);
    return NextResponse.json(
      { error: 'Failed to create quote' },
      { status: 500 }
    );
  }
}
