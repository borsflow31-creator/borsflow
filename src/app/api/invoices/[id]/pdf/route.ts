import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { renderDocumentPdf, pdfFilename } from '@/lib/documents/pdf';

// React-PDF needs Node APIs, not the edge runtime.
export const runtime = 'nodejs';

// GET /api/invoices/[id]/pdf - Download the invoice as a PDF
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
        payments: { orderBy: { paymentDate: 'desc' } },
        workspace: { select: { id: true, name: true } },
      },
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

    const pdf = await renderDocumentPdf({
      kind: 'invoice',
      number: invoice.invoiceNumber,
      status: invoice.status,
      workspaceName: invoice.workspace.name,
      clientName: invoice.clientName,
      clientEmail: invoice.clientEmail,
      clientPhone: invoice.clientPhone,
      clientCompany: invoice.clientCompany,
      clientAddress: invoice.clientAddress,
      issueDate: invoice.issueDate,
      secondaryDate: invoice.dueDate,
      currency: invoice.currency,
      items: invoice.items,
      subtotal: invoice.subtotal,
      discountAmount: invoice.discountAmount,
      taxRate: invoice.taxRate,
      taxAmount: invoice.taxAmount,
      total: invoice.total,
      amountPaid: invoice.amountPaid,
      amountDue: invoice.amountDue,
      payments: invoice.payments,
      notes: invoice.notes,
      terms: invoice.terms,
    });

    // `inline` so clicking the action opens the PDF in the browser's viewer, from
    // which the client can still save it under the filename below.
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${pdfFilename({ number: invoice.invoiceNumber })}"`,
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (error) {
    console.error('Error generating invoice PDF:', error);
    return NextResponse.json({ error: 'Failed to generate PDF' }, { status: 500 });
  }
}
