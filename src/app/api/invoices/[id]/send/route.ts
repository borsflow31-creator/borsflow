import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { canEditContent, READ_ONLY_ERROR } from '@/lib/api/workspace';
import { escapeHtml, escapeHtmlMultiline } from '@/lib/html';
import { renderDocumentPdf, pdfFilename } from '@/lib/documents/pdf';
import { shareDocument } from '@/lib/documents/share';
import { sendDocumentEmail, DocumentEmailError } from '@/lib/documents/send-email';

// POST /api/invoices/[id]/send
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
      include: { items: { orderBy: { order: 'asc' } } },
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
    const { to, subject, message } = body;
    // 'workspace' = the workspace's own connected email; anything else = BorsFlow
    const sendFrom = body.sendFrom === 'workspace' ? 'workspace' : 'platform';

    const recipientEmail = to || invoice.clientEmail;
    if (!recipientEmail) {
      return NextResponse.json(
        { error: 'Recipient email is required' },
        { status: 400 }
      );
    }

    const formatCurrency = (amount: number, currency: string) =>
      new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);

    const formatDate = (date: Date | string | null) =>
      date
        ? new Date(date).toLocaleDateString('en-US', {
            month: 'long',
            day: 'numeric',
            year: 'numeric',
          })
        : 'N/A';

    const itemsHtml = invoice.items
      .map(
        (item) => `
        <tr>
          <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;">${escapeHtml(item.description)}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;text-align:center;">${item.quantity}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;text-align:right;">${formatCurrency(item.unitPrice, invoice.currency)}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;text-align:right;font-weight:600;">${formatCurrency(item.total, invoice.currency)}</td>
        </tr>`
      )
      .join('');

    // Sending an invoice is exactly when the client needs a way to open it.
    const { url: publicUrl } = await shareDocument('invoice', invoice.id);

    const viewButtonHtml = `<div style="text-align:center;margin:16px 0 0;">
          <a href="${escapeHtml(publicUrl)}" style="font-size:13px;color:#2563eb;text-decoration:underline;">
            View this invoice online
          </a>
        </div>`;

    const emailHtml = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Invoice ${escapeHtml(invoice.invoiceNumber)}</title></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#1a1a1a;background:#f9fafb;margin:0;padding:0;">
  <div style="max-width:600px;margin:40px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.1);">
    <div style="background:linear-gradient(135deg,#1e293b 0%,#334155 100%);padding:40px;color:#fff;">
      <h1 style="margin:0 0 8px;font-size:28px;font-weight:700;">${escapeHtml(invoice.invoiceNumber)}</h1>
      <p style="margin:0;opacity:.8;font-size:15px;">${escapeHtml(workspace.name)}</p>
    </div>
    <div style="padding:32px;">
      <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#374151;">
        ${message ? escapeHtmlMultiline(message) : `Dear ${escapeHtml(invoice.clientName)},<br><br>Please find your invoice details below. Payment is due by ${formatDate(invoice.dueDate)}.`}
      </p>
      ${viewButtonHtml}
      <div style="background:#f8fafc;border-radius:8px;padding:20px;margin-bottom:24px;">
        <div style="display:flex;justify-content:space-between;margin-bottom:12px;">
          <span style="color:#6b7280;font-size:13px;">Invoice Number</span>
          <span style="font-weight:600;">${escapeHtml(invoice.invoiceNumber)}</span>
        </div>
        <div style="display:flex;justify-content:space-between;margin-bottom:12px;">
          <span style="color:#6b7280;font-size:13px;">Issue Date</span>
          <span>${formatDate(invoice.issueDate)}</span>
        </div>
        <div style="display:flex;justify-content:space-between;margin-bottom:12px;">
          <span style="color:#6b7280;font-size:13px;">Due Date</span>
          <span style="color:${invoice.dueDate && new Date(invoice.dueDate) < new Date() ? '#ef4444' : 'inherit'}">${formatDate(invoice.dueDate)}</span>
        </div>
        <div style="display:flex;justify-content:space-between;padding-top:12px;border-top:2px solid #e5e7eb;">
          <span style="font-weight:700;font-size:16px;">Amount Due</span>
          <span style="font-weight:700;font-size:20px;color:#1e40af;">${formatCurrency(invoice.amountDue, invoice.currency)}</span>
        </div>
      </div>
      <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
        <thead>
          <tr style="background:#f1f5f9;">
            <th style="padding:10px 12px;text-align:left;font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:.05em;">Description</th>
            <th style="padding:10px 12px;text-align:center;font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:.05em;">Qty</th>
            <th style="padding:10px 12px;text-align:right;font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:.05em;">Unit Price</th>
            <th style="padding:10px 12px;text-align:right;font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:.05em;">Total</th>
          </tr>
        </thead>
        <tbody>${itemsHtml}</tbody>
        <tfoot>
          <tr>
            <td colspan="3" style="padding:12px;text-align:right;font-size:13px;color:#6b7280;">Subtotal</td>
            <td style="padding:12px;text-align:right;">${formatCurrency(invoice.subtotal, invoice.currency)}</td>
          </tr>
          ${invoice.discountAmount > 0 ? `<tr><td colspan="3" style="padding:4px 12px;text-align:right;font-size:13px;color:#6b7280;">Discount</td><td style="padding:4px 12px;text-align:right;color:#10b981;">-${formatCurrency(invoice.discountAmount, invoice.currency)}</td></tr>` : ''}
          ${invoice.taxAmount > 0 ? `<tr><td colspan="3" style="padding:4px 12px;text-align:right;font-size:13px;color:#6b7280;">Tax (${invoice.taxRate}%)</td><td style="padding:4px 12px;text-align:right;">${formatCurrency(invoice.taxAmount, invoice.currency)}</td></tr>` : ''}
          <tr style="background:#f8fafc;">
            <td colspan="3" style="padding:12px;text-align:right;font-weight:700;">Total</td>
            <td style="padding:12px;text-align:right;font-weight:700;font-size:16px;">${formatCurrency(invoice.total, invoice.currency)}</td>
          </tr>
        </tfoot>
      </table>
      ${invoice.notes ? `<div style="background:#fefce8;border-left:4px solid #fbbf24;padding:16px;border-radius:4px;margin-bottom:16px;"><p style="margin:0;font-size:14px;color:#374151;">${escapeHtmlMultiline(invoice.notes)}</p></div>` : ''}
      ${invoice.terms ? `<p style="font-size:12px;color:#9ca3af;margin-top:16px;">${escapeHtmlMultiline(invoice.terms)}</p>` : ''}
    </div>
    <div style="background:#f1f5f9;padding:20px;text-align:center;">
      <p style="margin:0;font-size:12px;color:#9ca3af;">This invoice was sent by ${escapeHtml(workspace.name)}</p>
    </div>
  </div>
</body>
</html>`;

    // The invoice travels as a real PDF attachment; before this the email was the
    // only artifact the client received.
    const pdf = await renderDocumentPdf({
      kind: 'invoice',
      number: invoice.invoiceNumber,
      status: invoice.status,
      workspaceName: workspace.name,
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
      notes: invoice.notes,
      terms: invoice.terms,
    });

    await sendDocumentEmail({
      sendFrom,
      workspaceId: workspace.id,
      userId: session.user.id,
      document: { kind: 'invoice', id: invoice.id, number: invoice.invoiceNumber },
      to: recipientEmail,
      subject: subject || `Invoice ${invoice.invoiceNumber} from ${workspace.name}`,
      html: emailHtml,
      attachments: [
        {
          filename: pdfFilename({ number: invoice.invoiceNumber }),
          content: pdf,
          contentType: 'application/pdf',
        },
      ],
    });

    // Update invoice status to 'sent'
    const updatedInvoice = await prisma.invoice.update({
      where: { id: params.id },
      data: {
        status: invoice.status === 'draft' ? 'sent' : invoice.status,
        sentAt: new Date(),
        updatedBy: session.user.id,

      },
    });

    return NextResponse.json({
      success: true,
      message: `Invoice sent to ${recipientEmail}`,
      invoice: updatedInvoice,
    });
  } catch (error) {
    if (error instanceof DocumentEmailError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error sending invoice:', error);
    return NextResponse.json({ error: 'Failed to send invoice' }, { status: 500 });
  }
}
