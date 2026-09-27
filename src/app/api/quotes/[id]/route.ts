import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { canEditContent, READ_ONLY_ERROR } from '@/lib/api/workspace';
import { calculateDocumentTotals, buildItemCreateData } from '@/lib/documents/calculations';
import { isValidQuoteStatus, quoteStatusTimestamps, QUOTE_STATUSES } from '@/lib/documents/status';

// GET /api/quotes/[id] - Get quote by ID
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const quote = await prisma.quote.findUnique({
      where: { id: params.id },
      include: {
        items: { orderBy: { order: 'asc' } },
        quoteNotes: { orderBy: { createdAt: 'desc' } },
        lead: { select: { id: true, firstName: true, lastName: true } },
        workspace: { select: { id: true, name: true } }
      }
    });

    if (!quote) {
      return NextResponse.json({ error: 'Quote not found' }, { status: 404 });
    }

    // Check if user has access to workspace
    const workspace = await prisma.workspace.findFirst({
      where: {
        id: quote.workspaceId,
        OR: [
          { ownerId: session.user.id },
          { members: { some: { userId: session.user.id } } },
        ],
      },
    });

    if (!workspace) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    return NextResponse.json({ quote });
  } catch (error) {
    console.error('Error fetching quote:', error);
    return NextResponse.json(
      { error: 'Failed to fetch quote' },
      { status: 500 }
    );
  }
}

// PUT /api/quotes/[id] - Update quote
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const existingQuote = await prisma.quote.findUnique({
      where: { id: params.id },
      include: { workspace: true, items: { orderBy: { order: 'asc' } } }
    });

    if (!existingQuote) {
      return NextResponse.json({ error: 'Quote not found' }, { status: 404 });
    }

    // Check if user has access to workspace
    const workspace = await prisma.workspace.findFirst({
      where: {
        id: existingQuote.workspaceId,
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

    const body = await request.json();
    const {
      status,
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

    if (status !== undefined && !isValidQuoteStatus(status)) {
      return NextResponse.json(
        { error: `Status must be one of: ${QUOTE_STATUSES.join(', ')}` },
        { status: 400 }
      );
    }

    if (items !== undefined && !Array.isArray(items)) {
      return NextResponse.json({ error: 'Items must be an array' }, { status: 400 });
    }

    // Totals are always recomputed. Gating this on `items` meant a request that
    // changed only the tax rate or the discount persisted the new rate while
    // leaving taxAmount and total at their old values. When the request omits
    // items, the stored ones are the correct basis.
    const effectiveItems = items ?? existingQuote.items;
    const totals = calculateDocumentTotals(effectiveItems, {
      taxRate: taxRate !== undefined ? taxRate : existingQuote.taxRate,
      discountType: discountType !== undefined ? discountType : existingQuote.discountType,
      discountValue: discountValue !== undefined ? discountValue : existingQuote.discountValue,
    });

    // Each lifecycle stamp records the first time the quote reached that state.
    const statusStamps = isValidQuoteStatus(status)
      ? quoteStatusTimestamps(status, existingQuote)
      : {};

    // Update quote
    const quote = await prisma.quote.update({
      where: { id: params.id },
      data: {
        status: status !== undefined ? status : undefined,
        clientName: clientName !== undefined ? clientName : undefined,
        clientEmail: clientEmail !== undefined ? clientEmail : undefined,
        clientPhone: clientPhone !== undefined ? clientPhone : undefined,
        clientCompany: clientCompany !== undefined ? clientCompany : undefined,
        clientAddress: clientAddress !== undefined ? clientAddress || null : undefined,
        issueDate: issueDate !== undefined ? new Date(issueDate) : undefined,
        validUntil: validUntil !== undefined ? (validUntil ? new Date(validUntil) : null) : undefined,
        currency: currency !== undefined ? currency : undefined,
        taxRate: taxRate !== undefined ? taxRate : undefined,
        discountType: discountType !== undefined ? (discountType && discountType !== 'none' ? discountType : null) : undefined,
        discountValue: discountValue !== undefined ? discountValue : undefined,
        notes: notes !== undefined ? notes : undefined,
        terms: terms !== undefined ? terms : undefined,
        internalNotes: internalNotes !== undefined ? internalNotes : undefined,
        subtotal: totals.subtotal,
        discountAmount: totals.discountAmount,
        taxAmount: totals.taxAmount,
        total: totals.total,
        updatedBy: session.user.id,
        ...statusStamps,
        items: items ? {
          deleteMany: {},
          create: buildItemCreateData(items)
        } : undefined
      },
      include: {
        items: { orderBy: { order: 'asc' } },
        lead: { select: { id: true, firstName: true, lastName: true } }
      }
    });

    return NextResponse.json({ quote });
  } catch (error) {
    console.error('Error updating quote:', error);
    return NextResponse.json(
      { error: 'Failed to update quote' },
      { status: 500 }
    );
  }
}

// DELETE /api/quotes/[id] - Delete quote
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const existingQuote = await prisma.quote.findUnique({
      where: { id: params.id },
      select: { workspaceId: true }
    });

    if (!existingQuote) {
      return NextResponse.json({ error: 'Quote not found' }, { status: 404 });
    }

    // Check if user has access to workspace
    const workspace = await prisma.workspace.findFirst({
      where: {
        id: existingQuote.workspaceId,
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

    // Delete quote
    await prisma.quote.delete({
      where: { id: params.id }
    });

    return NextResponse.json({ success: true, message: 'Quote deleted successfully' });
  } catch (error) {
    console.error('Error deleting quote:', error);
    return NextResponse.json(
      { error: 'Failed to delete quote' },
      { status: 500 }
    );
  }
}
