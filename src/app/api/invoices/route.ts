import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { canEditContent, READ_ONLY_ERROR } from '@/lib/api/workspace';
import { calculateDocumentTotals, buildItemCreateData } from '@/lib/documents/calculations';
import { createWithDocumentNumber } from '@/lib/documents/numbering';
import { parsePagination, parseInvoiceSort, buildClientSearchFilter } from '@/lib/documents/query';

// GET /api/invoices - List invoices
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get('workspaceId');
    const status = searchParams.get('status');
    const leadId = searchParams.get('leadId');
    const quoteId = searchParams.get('quoteId');
    const search = searchParams.get('search');
    const { page, limit, skip, take } = parsePagination(searchParams);
    const orderBy = parseInvoiceSort(searchParams.get('sortBy'));

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

    if (quoteId) {
      where.quoteId = quoteId;
    }

    if (search) {
      where.OR = [
        ...buildClientSearchFilter(search),
        { invoiceNumber: { contains: search, mode: 'insensitive' as const } },
      ];
    }

    // Get total count
    const total = await prisma.invoice.count({ where });

    // Get invoices with pagination
    const invoices = await prisma.invoice.findMany({
      where,
      include: {
        items: { orderBy: { order: 'asc' } },
        payments: { orderBy: { paymentDate: 'desc' } },
        lead: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy,
      skip,
      take,
    });

    // Analytics are aggregated in the database. This used to load every invoice in
    // the workspace on every page view and reduce over it in JS, which grew without
    // bound as a workspace accumulated invoices.
    const now = new Date();
    const [byStatus, paidTotal, pendingDue, overdueDue] = await Promise.all([
      prisma.invoice.groupBy({
        by: ['status'],
        where: { workspaceId },
        _count: { _all: true },
      }),
      prisma.invoice.aggregate({
        where: { workspaceId, status: 'paid' },
        _sum: { total: true },
      }),
      prisma.invoice.aggregate({
        where: { workspaceId, status: { in: ['draft', 'sent', 'viewed'] } },
        _sum: { amountDue: true },
      }),
      // Stored `overdue` plus anything already past its due date but not yet swept
      // by the cron, so the figure is right between runs.
      prisma.invoice.aggregate({
        where: {
          workspaceId,
          OR: [
            { status: 'overdue' },
            { dueDate: { lt: now }, status: { notIn: ['paid', 'cancelled', 'draft'] } },
          ],
        },
        _sum: { amountDue: true },
      }),
    ]);

    const countFor = (...statuses: string[]) =>
      byStatus
        .filter((row) => statuses.includes(row.status))
        .reduce((sum, row) => sum + row._count._all, 0);

    const analytics = {
      totalRevenue: paidTotal._sum.total ?? 0,
      pendingAmount: pendingDue._sum.amountDue ?? 0,
      overdueAmount: overdueDue._sum.amountDue ?? 0,
      counts: {
        total: byStatus.reduce((sum, row) => sum + row._count._all, 0),
        draft: countFor('draft'),
        sent: countFor('sent', 'viewed'),
        partially_paid: countFor('partially_paid'),
        paid: countFor('paid'),
        overdue: countFor('overdue'),
      },
    };

    return NextResponse.json({
      invoices,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
      analytics,
    });
  } catch (error) {
    console.error('Error fetching invoices:', error);
    return NextResponse.json({ error: 'Failed to fetch invoices' }, { status: 500 });
  }
}

// POST /api/invoices - Create invoice
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      workspaceId,
      leadId,
      quoteId,
      clientName,
      clientEmail,
      clientPhone,
      clientCompany,
      clientAddress,
      issueDate,
      dueDate,
      currency,
      taxRate,
      discountType,
      discountValue,
      notes,
      terms,
      internalNotes,
      items,
    } = body;

    if (items !== undefined && !Array.isArray(items)) {
      return NextResponse.json({ error: 'Items must be an array' }, { status: 400 });
    }

    if (!workspaceId || !clientName) {
      return NextResponse.json(
        { error: 'Workspace ID and client name are required' },
        { status: 400 }
      );
    }

    // Check workspace access
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

    // A linked quote must belong to this workspace. Otherwise another workspace's
    // quote would list this invoice as its conversion and refuse to convert.
    if (quoteId) {
      const quote = await prisma.quote.findFirst({ where: { id: quoteId, workspaceId }, select: { id: true } });
      if (!quote) {
        return NextResponse.json({ error: 'Quote not found in this workspace' }, { status: 400 });
      }
    }

    // If leadId provided, verify it belongs to this workspace
    let resolvedClientName = clientName;
    let resolvedClientEmail = clientEmail;
    let resolvedClientPhone = clientPhone;
    let resolvedClientCompany = clientCompany;

    if (leadId) {
      const lead = await prisma.lead.findUnique({
        where: { id: leadId },
        include: { pipeline: true },
      });

      if (!lead) {
        return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
      }

      const pipelineWorkspace = await prisma.pipeline.findUnique({
        where: { id: lead.pipelineId },
        select: { workspaceId: true },
      });

      if (pipelineWorkspace?.workspaceId !== workspaceId) {
        return NextResponse.json({ error: 'Lead does not belong to this workspace' }, { status: 400 });
      }

      resolvedClientName = `${lead.firstName} ${lead.lastName}`;
      resolvedClientEmail = lead.email || null;
      resolvedClientPhone = lead.phone || null;
      resolvedClientCompany = lead.company || null;
    }

    const totals = calculateDocumentTotals(items, { taxRate, discountType, discountValue });

    const invoice = await createWithDocumentNumber('invoice', workspaceId, (invoiceNumber) =>
      prisma.invoice.create({
        data: {
          invoiceNumber,
          workspaceId,
          leadId: leadId || null,
          quoteId: quoteId || null,
          clientName: resolvedClientName,
          clientEmail: resolvedClientEmail || null,
          clientPhone: resolvedClientPhone || null,
          clientCompany: resolvedClientCompany || null,
          clientAddress: clientAddress || null,
          status: 'draft',
          issueDate: issueDate ? new Date(issueDate) : new Date(),
          dueDate: dueDate ? new Date(dueDate) : null,
          currency: currency || 'USD',
          subtotal: totals.subtotal,
          taxRate: taxRate || 0,
          taxAmount: totals.taxAmount,
          discountType: discountType && discountType !== 'none' ? discountType : null,
          discountValue: discountValue || 0,
          discountAmount: totals.discountAmount,
          total: totals.total,
          amountPaid: 0,
          amountDue: totals.total,
          notes: notes || null,
          terms: terms || null,
          internalNotes: internalNotes || null,
          createdById: session.user.id,
          items: { create: buildItemCreateData(items) },
        },
        include: {
          items: { orderBy: { order: 'asc' } },
          payments: true,
          lead: { select: { id: true, firstName: true, lastName: true } },
        },
      })
    );

    return NextResponse.json({ invoice }, { status: 201 });
  } catch (error) {
    console.error('Error creating invoice:', error);
    return NextResponse.json({ error: 'Failed to create invoice' }, { status: 500 });
  }
}
