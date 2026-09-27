import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { canEditContent, READ_ONLY_ERROR } from '@/lib/api/workspace';
import { createInvoicePaymentLink, getOrCreateCustomer } from '@/lib/stripe';
import { createWithDocumentNumber } from '@/lib/documents/numbering';

// POST /api/quotes/[id]/convert - Convert quote to invoice
export async function POST(
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
        invoices: { select: { id: true, invoiceNumber: true } },
      },
    });

    if (!quote) {
      return NextResponse.json({ error: 'Quote not found' }, { status: 404 });
    }

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

    // Membership is not enough to change content: viewers are read-only.
    if (!(await canEditContent(workspace.id, session.user.id))) {
      return NextResponse.json({ error: READ_ONLY_ERROR }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const { dueDate, force } = body;

    // Converting twice used to create a second invoice for the same quote, with
    // nothing to indicate which one was real. A repeat click now returns a conflict
    // naming the existing invoice unless the caller explicitly asks for another.
    if (quote.invoices.length > 0 && force !== true) {
      return NextResponse.json(
        {
          error: 'This quote has already been converted to an invoice',
          invoiceId: quote.invoices[0].id,
          invoiceNumber: quote.invoices[0].invoiceNumber,
        },
        { status: 409 }
      );
    }

    if (['rejected', 'expired'].includes(quote.status)) {
      return NextResponse.json(
        { error: `A ${quote.status} quote cannot be converted to an invoice` },
        { status: 400 }
      );
    }

    // The invoice and the quote's status change together, so a failure can't leave
    // an orphan invoice behind a quote that still looks unconverted.
    //
    // Each numbering attempt is its own transaction. A number collision aborts the
    // transaction it happens in, so the old loop, which retried inside a single
    // transaction, failed with "current transaction is aborted" on every retry.
    const invoice = await createWithDocumentNumber('invoice', quote.workspaceId, (invoiceNumber) =>
      prisma.$transaction(async (tx) => {
        const created = await tx.invoice.create({
          data: {
            invoiceNumber,
            workspaceId: quote.workspaceId,
            leadId: quote.leadId,
            quoteId: quote.id,
            clientName: quote.clientName,
            clientEmail: quote.clientEmail,
            clientPhone: quote.clientPhone,
            clientCompany: quote.clientCompany,
            clientAddress: quote.clientAddress,
            status: 'draft',
            issueDate: new Date(),
            dueDate: dueDate ? new Date(dueDate) : null,
            currency: quote.currency,
            subtotal: quote.subtotal,
            taxRate: quote.taxRate,
            taxAmount: quote.taxAmount,
            discountType: quote.discountType,
            discountValue: quote.discountValue,
            discountAmount: quote.discountAmount,
            total: quote.total,
            amountPaid: 0,
            amountDue: quote.total,
            notes: quote.notes,
            terms: quote.terms,
            internalNotes: quote.internalNotes,
            createdById: session.user.id,
            items: {
              create: quote.items.map((item) => ({
                description: item.description,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                discount: item.discount,
                taxRate: item.taxRate,
                total: item.total,
                order: item.order,
              })),
            },
          },
          include: {
            items: { orderBy: { order: 'asc' } },
            payments: true,
            lead: { select: { id: true, firstName: true, lastName: true } },
          },
        });

        // Mark quote as accepted if it was in draft/sent status
        if (['draft', 'sent', 'viewed'].includes(quote.status)) {
          await tx.quote.update({
            where: { id: quote.id },
            data: { status: 'accepted', acceptedAt: quote.acceptedAt ?? new Date() },
          });
        }

        return created;
      })
    );

    // Auto-generate a Stripe payment link if the workspace has Stripe connected
    const workspaceStripe = await prisma.workspace.findUnique({
      where: { id: quote.workspaceId },
      select: { stripeAccountId: true, stripeAccountEnabled: true },
    });

    if (workspaceStripe?.stripeAccountId && workspaceStripe.stripeAccountEnabled) {
      try {
        let stripeCustomerId: string | undefined;
        if (invoice.clientEmail) {
          stripeCustomerId = await getOrCreateCustomer(
            workspaceStripe.stripeAccountId,
            invoice.clientEmail,
            invoice.clientName
          );
        }

        const amountCents = Math.round(invoice.total * 100);
        const { url, paymentLinkId } = await createInvoicePaymentLink({
          connectedAccountId: workspaceStripe.stripeAccountId,
          invoiceId: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          amountCents,
          currency: invoice.currency,
          clientEmail: invoice.clientEmail ?? undefined,
        });

        await prisma.invoice.update({
          where: { id: invoice.id },
          data: {
            stripeCustomerId: stripeCustomerId ?? undefined,
            stripePaymentLink: url,
            stripePaymentLinkId: paymentLinkId,
            status: 'sent',
            sentAt: new Date(),
          },
        });

        return NextResponse.json(
          { invoice: { ...invoice, stripePaymentLink: url, status: 'sent' } },
          { status: 201 }
        );
      } catch (stripeErr) {
        // Non-fatal: invoice was created, payment link generation failed
        console.error('Failed to auto-generate payment link after quote conversion:', stripeErr);
      }
    }

    return NextResponse.json({ invoice }, { status: 201 });
  } catch (error) {
    console.error('Error converting quote to invoice:', error);
    return NextResponse.json({ error: 'Failed to convert quote to invoice' }, { status: 500 });
  }
}
