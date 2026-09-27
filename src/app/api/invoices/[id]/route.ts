import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { canEditContent, READ_ONLY_ERROR } from '@/lib/api/workspace';
import { calculateDocumentTotals, buildItemCreateData } from '@/lib/documents/calculations';
import { derivePaymentState } from '@/lib/documents/payments';
import { isValidInvoiceStatus, INVOICE_STATUSES } from '@/lib/documents/status';

// GET /api/invoices/[id]
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const invoice = await prisma.invoice.findUnique({
      where: { id: params.id },
      include: {
        items: { orderBy: { order: 'asc' } },
        invoiceNotes: { orderBy: { createdAt: 'desc' } },
        payments: { orderBy: { paymentDate: 'desc' } },
        lead: { select: { id: true, firstName: true, lastName: true } },
        quote: { select: { id: true, quoteNumber: true } },
        workspace: { select: { id: true, name: true } },
      },
    });

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    // Check workspace access
    const workspace = await prisma.workspace.findFirst({
      where: {
        id: invoice.workspaceId,
        OR: [
          { ownerId: session.user.id },
          { members: { some: { userId: session.user.id } } },
        ],
      },
    });

    if (!workspace) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    return NextResponse.json({ invoice });
  } catch (error) {
    console.error('Error fetching invoice:', error);
    return NextResponse.json({ error: 'Failed to fetch invoice' }, { status: 500 });
  }
}

// PUT /api/invoices/[id]
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const existingInvoice = await prisma.invoice.findUnique({
      where: { id: params.id },
      include: { items: { orderBy: { order: 'asc' } } },
    });

    if (!existingInvoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    // Check workspace access
    const workspace = await prisma.workspace.findFirst({
      where: {
        id: existingInvoice.workspaceId,
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
      dueDate,
      paidDate,
      currency,
      taxRate,
      discountType,
      discountValue,
      notes,
      terms,
      internalNotes,
      paymentMethod,
      paymentReference,
      items,
    } = body;

    if (status !== undefined && !isValidInvoiceStatus(status)) {
      return NextResponse.json(
        { error: `Status must be one of: ${INVOICE_STATUSES.join(', ')}` },
        { status: 400 }
      );
    }

    if (items !== undefined && !Array.isArray(items)) {
      return NextResponse.json({ error: 'Items must be an array' }, { status: 400 });
    }

    // Totals are always recomputed. Gating this on `items` meant a request that
    // changed only the tax rate persisted the new rate while leaving taxAmount and
    // total stale. When the request omits items, the stored ones are the basis.
    const effectiveItems = items ?? existingInvoice.items;
    const totals = calculateDocumentTotals(effectiveItems, {
      taxRate: taxRate !== undefined ? taxRate : existingInvoice.taxRate,
      discountType: discountType !== undefined ? discountType : existingInvoice.discountType,
      discountValue: discountValue !== undefined ? discountValue : existingInvoice.discountValue,
    });

    // Payment fields come from the shared reconciler against the new total, so
    // amountDue is clamped here exactly as it is on the payment routes rather than
    // being allowed to go negative on an overpaid invoice.
    const payments = await prisma.payment.findMany({
      where: { invoiceId: params.id },
      select: { amount: true },
    });
    const paymentState = derivePaymentState({
      total: totals.total,
      payments,
      currentStatus: status !== undefined ? status : existingInvoice.status,
      currentPaidDate: existingInvoice.paidDate,
    });

    // An explicit status in the request wins over the payment-derived one, so a
    // user can still mark an invoice cancelled while it carries payments.
    const resolvedStatus = status !== undefined ? status : paymentState.status;

    // Determine sentAt / viewedAt based on status changes
    const statusUpdateData: any = {};
    if (status === 'sent' && !existingInvoice.sentAt) {
      statusUpdateData.sentAt = new Date();
    }
    if (status === 'viewed' && !existingInvoice.viewedAt) {
      statusUpdateData.viewedAt = new Date();
    }
    if (status === 'paid' && !existingInvoice.paidDate) {
      statusUpdateData.paidDate = paidDate ? new Date(paidDate) : new Date();
    }

    const invoice = await prisma.invoice.update({
      where: { id: params.id },
      data: {
        status: resolvedStatus,
        clientName: clientName !== undefined ? clientName : undefined,
        clientEmail: clientEmail !== undefined ? clientEmail : undefined,
        clientPhone: clientPhone !== undefined ? clientPhone : undefined,
        clientCompany: clientCompany !== undefined ? clientCompany : undefined,
        clientAddress: clientAddress !== undefined ? clientAddress || null : undefined,
        issueDate: issueDate !== undefined ? (issueDate ? new Date(issueDate) : undefined) : undefined,
        dueDate: dueDate !== undefined ? (dueDate ? new Date(dueDate) : null) : undefined,
        currency: currency !== undefined ? currency : undefined,
        taxRate: taxRate !== undefined ? taxRate : undefined,
        discountType: discountType !== undefined ? (discountType && discountType !== 'none' ? discountType : null) : undefined,
        discountValue: discountValue !== undefined ? discountValue : undefined,
        notes: notes !== undefined ? notes : undefined,
        terms: terms !== undefined ? terms : undefined,
        internalNotes: internalNotes !== undefined ? internalNotes : undefined,
        paymentMethod: paymentMethod !== undefined ? paymentMethod : undefined,
        paymentReference: paymentReference !== undefined ? paymentReference : undefined,
        subtotal: totals.subtotal,
        discountAmount: totals.discountAmount,
        taxAmount: totals.taxAmount,
        total: totals.total,
        amountPaid: paymentState.amountPaid,
        amountDue: paymentState.amountDue,
        updatedBy: session.user.id,
        ...statusUpdateData,
        items: items
          ? {
              deleteMany: {},
              create: buildItemCreateData(items),
            }
          : undefined,
      },
      include: {
        items: { orderBy: { order: 'asc' } },
        payments: { orderBy: { paymentDate: 'desc' } },
        lead: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    return NextResponse.json({ invoice });
  } catch (error) {
    console.error('Error updating invoice:', error);
    return NextResponse.json({ error: 'Failed to update invoice' }, { status: 500 });
  }
}

// DELETE /api/invoices/[id]
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const existingInvoice = await prisma.invoice.findUnique({
      where: { id: params.id },
      select: { workspaceId: true },
    });

    if (!existingInvoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    // Check workspace access
    const workspace = await prisma.workspace.findFirst({
      where: {
        id: existingInvoice.workspaceId,
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

    await prisma.invoice.delete({ where: { id: params.id } });

    return NextResponse.json({ success: true, message: 'Invoice deleted successfully' });
  } catch (error) {
    console.error('Error deleting invoice:', error);
    return NextResponse.json({ error: 'Failed to delete invoice' }, { status: 500 });
  }
}
