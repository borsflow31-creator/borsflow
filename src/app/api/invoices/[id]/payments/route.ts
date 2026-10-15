import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { randomUUID } from 'crypto';
import { canEditContent, getWorkspaceRole, READ_ONLY_ERROR } from '@/lib/api/workspace';
import {
  PAYMENT_METHODS,
  isValidPaymentMethod,
  recalculateInvoicePayment,
} from '@/lib/documents/payments';
import { recordCallPayment, recordDepositPayment } from '@/lib/services/developer/collections';
import { ServiceError } from '@/lib/services/errors';

const INVOICE_WITH_PAYMENTS = {
  items: { orderBy: { order: 'asc' as const } },
  payments: { orderBy: { paymentDate: 'desc' as const } },
  lead: { select: { id: true, firstName: true, lastName: true } },
  callForFunds: { select: { id: true, lotId: true } },
};

// GET /api/invoices/[id]/payments
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
      select: { workspaceId: true },
    });

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

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

    const payments = await prisma.payment.findMany({
      where: { invoiceId: params.id },
      orderBy: { paymentDate: 'desc' },
    });

    return NextResponse.json({ payments });
  } catch (error) {
    console.error('Error fetching payments:', error);
    return NextResponse.json({ error: 'Failed to fetch payments' }, { status: 500 });
  }
}

// POST /api/invoices/[id]/payments
export async function POST(
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
    });

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

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


    // Membership is not enough to change content: viewers are read-only.
    if (!(await canEditContent(workspace.id, session.user.id))) {
      return NextResponse.json({ error: READ_ONLY_ERROR }, { status: 403 });
    }

    const body = await request.json();
    const { amount, paymentDate, paymentMethod, referenceNumber, notes } = body;

    // A numeric string would reach the Float column and fail as a 500; reject it here.
    if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: 'Valid payment amount is required' }, { status: 400 });
    }

    if (!isValidPaymentMethod(paymentMethod)) {
      return NextResponse.json(
        { error: `Payment method must be one of: ${PAYMENT_METHODS.join(', ')}` },
        { status: 400 }
      );
    }

    const parsedDate = paymentDate ? new Date(paymentDate) : new Date();
    if (Number.isNaN(parsedDate.getTime())) {
      return NextResponse.json({ error: 'Invalid payment date' }, { status: 400 });
    }

    // A call for funds' invoice is paid through the encaissement ledger, so the
    // amount is capped at what is still owed, concurrent payments are serialised,
    // a cheque waits to clear and the call's own status follows.
    // A unit's deposit invoice goes through the same ledger.
    const linkedCall = await prisma.callForFunds.findUnique({ where: { invoiceId: params.id }, select: { id: true } });
    const depositLot = linkedCall ? null : await prisma.developmentLot.findUnique({ where: { depositInvoiceId: params.id }, select: { id: true } });
    if (linkedCall || depositLot) {
      const ctx = { workspaceId: workspace.id, userId: session.user.id };
      const input = {
        amount,
        paidAt: paymentDate,
        method: paymentMethod,
        reference: referenceNumber,
        notes,
        clientRequestId: typeof body.clientRequestId === 'string' ? body.clientRequestId : randomUUID(),
      };
      try {
        if (linkedCall) await recordCallPayment(ctx, linkedCall.id, input);
        else await recordDepositPayment(ctx, depositLot!.id, input);
      } catch (error) {
        if (error instanceof ServiceError) {
          return NextResponse.json({ error: error.message }, { status: error.status });
        }
        throw error;
      }
      const updatedInvoice = await prisma.invoice.update({
        where: { id: params.id },
        data: { updatedBy: session.user.id },
        include: INVOICE_WITH_PAYMENTS,
      });
      return NextResponse.json({ invoice: updatedInvoice }, { status: 201 });
    }

    // The payment row and the invoice's cached payment totals must move together,
    // or a failure here leaves amountPaid/amountDue permanently out of sync.
    const { payment, updatedInvoice } = await prisma.$transaction(async (tx) => {
      const payment = await tx.payment.create({
        data: {
          invoiceId: params.id,
          amount,
          paymentDate: parsedDate,
          paymentMethod,
          referenceNumber: referenceNumber || null,
          notes: notes || null,
          workspaceId: workspace.id,
          status: 'confirmed',
          confirmedAt: new Date(),
          confirmedById: session.user.id,
          createdById: session.user.id,
        },
      });

      await recalculateInvoicePayment(tx, params.id);

      const updatedInvoice = await tx.invoice.update({
        where: { id: params.id },
        data: { updatedBy: session.user.id },
        include: INVOICE_WITH_PAYMENTS,
      });

      return { payment, updatedInvoice };
    });

    return NextResponse.json({ payment, invoice: updatedInvoice }, { status: 201 });
  } catch (error) {
    console.error('Error recording payment:', error);
    return NextResponse.json({ error: 'Failed to record payment' }, { status: 500 });
  }
}

// DELETE /api/invoices/[id]/payments?paymentId=xxx&reason=...
// A payment is never deleted: it is marked reversed, with who, when and why, and
// stops counting. Owners and admins only, like reversals in encaissement.
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const paymentId = searchParams.get('paymentId');

    if (!paymentId) {
      return NextResponse.json({ error: 'Payment ID is required' }, { status: 400 });
    }

    const invoice = await prisma.invoice.findUnique({
      where: { id: params.id },
    });

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

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


    // Membership is not enough to change content: viewers are read-only.
    if (!(await canEditContent(workspace.id, session.user.id))) {
      return NextResponse.json({ error: READ_ONLY_ERROR }, { status: 403 });
    }

    const role = await getWorkspaceRole(workspace.id, session.user.id);
    if (role !== 'owner' && role !== 'admin') {
      return NextResponse.json({ error: 'Only an owner or admin can reverse a payment' }, { status: 403 });
    }

    const linkedCall = await prisma.callForFunds.findUnique({ where: { invoiceId: params.id }, select: { id: true } });
    const deposit = await prisma.invoice.findFirst({ where: { id: params.id, depositForLotId: { not: null } }, select: { id: true } });
    if (linkedCall || deposit) {
      return NextResponse.json(
        { error: 'This payment belongs to a call for funds or a deposit: reverse it from Encaissements' },
        { status: 409 }
      );
    }

    const reason = (searchParams.get('reason') ?? '').trim().slice(0, 500) || null;

    const result = await prisma.$transaction(async (tx) => {
      // Scope to the invoice whose workspace was just authorized, so a payment id from
      // another tenant can't be reached through this endpoint.
      const reversed = await tx.payment.updateMany({
        where: { id: paymentId, invoiceId: params.id, status: 'confirmed' },
        data: { status: 'reversed', reversedAt: new Date(), reversedById: session.user.id, reversalReason: reason },
      });

      if (reversed.count === 0) return null;

      // Status is re-derived from the remaining rows, so reversing the last payment
      // from a draft, overdue or cancelled invoice no longer marks it as sent.
      await recalculateInvoicePayment(tx, params.id);

      return tx.invoice.update({
        where: { id: params.id },
        data: { updatedBy: session.user.id },
        include: {
          items: { orderBy: { order: 'asc' } },
          payments: { orderBy: { paymentDate: 'desc' } },
        },
      });
    });

    if (!result) {
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, invoice: result });
  } catch (error) {
    console.error('Error deleting payment:', error);
    return NextResponse.json({ error: 'Failed to delete payment' }, { status: 500 });
  }
}
