import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { canEditContent, READ_ONLY_ERROR } from '@/lib/api/workspace';
import { escapeHtml, escapeHtmlMultiline } from '@/lib/html';
import { renderDocumentPdf, pdfFilename } from '@/lib/documents/pdf';
import { shareDocument } from '@/lib/documents/share';
import { sendDocumentEmail, DocumentEmailError } from '@/lib/documents/send-email';

// POST /api/quotes/[id]/send
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
      include: { items: { orderBy: { order: 'asc' } } },
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

    const body = await request.json();
    const { to, subject, message } = body;
    // 'workspace' = the workspace's own connected email; anything else = BorsFlow
    const sendFrom = body.sendFrom === 'workspace' ? 'workspace' : 'platform';

    const recipientEmail = to || quote.clientEmail;
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

    const itemsHtml = quote.items
      .map(
        (item) => `
        <tr>
          <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;">${escapeHtml(item.description)}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;text-align:center;">${item.quantity}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;text-align:right;">${formatCurrency(item.unitPrice, quote.currency)}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;text-align:right;font-weight:600;">${formatCurrency(item.total, quote.currency)}</td>
        </tr>`
      )
      .join('');

    // Sending a quote is exactly when the client needs a way to open it, so the
    // share link is minted here and carried in the email. Without it the recipient
    // had no way to view or respond to the quote at all.
    const { url: publicUrl } = await shareDocument('quote', quote.id);

    const viewButtonHtml = `<div style="text-align:center;margin:24px 0;">
          <a href="${escapeHtml(publicUrl)}"
             style="display:inline-block;padding:14px 32px;background:#047857;color:#fff;text-decoration:none;border-radius:8px;font-weight:700;font-size:16px;">
            View &amp; respond to quote
          </a>
          <p style="margin:8px 0 0;font-size:12px;color:#9ca3af;">Accept or decline online</p>
        </div>`;

    const emailHtml = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Quote ${escapeHtml(quote.quoteNumber)}</title></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#1a1a1a;background:#f9fafb;margin:0;padding:0;">
  <div style="max-width:600px;margin:40px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.1);">
    <div style="background:linear-gradient(135deg,#065f46 0%,#047857 100%);padding:40px;color:#fff;">
      <h1 style="margin:0 0 8px;font-size:28px;font-weight:700;">Quote ${escapeHtml(quote.quoteNumber)}</h1>
      <p style="margin:0;opacity:.8;font-size:15px;">${escapeHtml(workspace.name)}</p>
    </div>
    <div style="padding:32px;">
      <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#374151;">
        ${message ? escapeHtmlMultiline(message) : `Dear ${escapeHtml(quote.clientName)},<br><br>Please review the quote below. This quote is valid until ${formatDate(quote.validUntil)}.`}
      </p>
      ${viewButtonHtml}
      <div style="background:#f8fafc;border-radius:8px;padding:20px;margin-bottom:24px;">
        <div style="display:flex;justify-content:space-between;margin-bottom:12px;">
          <span style="color:#6b7280;font-size:13px;">Quote Number</span>
          <span style="font-weight:600;">${escapeHtml(quote.quoteNumber)}</span>
        </div>
        <div style="display:flex;justify-content:space-between;margin-bottom:12px;">
          <span style="color:#6b7280;font-size:13px;">Issue Date</span>
          <span>${formatDate(quote.issueDate)}</span>
        </div>
        <div style="display:flex;justify-content:space-between;padding-top:12px;border-top:2px solid #e5e7eb;">
          <span style="font-weight:700;font-size:16px;">Total</span>
          <span style="font-weight:700;font-size:20px;color:#065f46;">${formatCurrency(quote.total, quote.currency)}</span>
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
            <td style="padding:12px;text-align:right;">${formatCurrency(quote.subtotal, quote.currency)}</td>
          </tr>
          ${quote.discountAmount > 0 ? `<tr><td colspan="3" style="padding:4px 12px;text-align:right;font-size:13px;color:#6b7280;">Discount</td><td style="padding:4px 12px;text-align:right;color:#10b981;">-${formatCurrency(quote.discountAmount, quote.currency)}</td></tr>` : ''}
          ${quote.taxAmount > 0 ? `<tr><td colspan="3" style="padding:4px 12px;text-align:right;font-size:13px;color:#6b7280;">Tax (${quote.taxRate}%)</td><td style="padding:4px 12px;text-align:right;">${formatCurrency(quote.taxAmount, quote.currency)}</td></tr>` : ''}
          <tr style="background:#f8fafc;">
            <td colspan="3" style="padding:12px;text-align:right;font-weight:700;">Total</td>
            <td style="padding:12px;text-align:right;font-weight:700;font-size:16px;">${formatCurrency(quote.total, quote.currency)}</td>
          </tr>
        </tfoot>
      </table>
      ${quote.notes ? `<div style="background:#f0fdf4;border-left:4px solid #10b981;padding:16px;border-radius:4px;margin-bottom:16px;"><p style="margin:0;font-size:14px;color:#374151;">${escapeHtmlMultiline(quote.notes)}</p></div>` : ''}
      ${quote.terms ? `<p style="font-size:12px;color:#9ca3af;margin-top:16px;">${escapeHtmlMultiline(quote.terms)}</p>` : ''}
    </div>
    <div style="background:#f1f5f9;padding:20px;text-align:center;">
      <p style="margin:0;font-size:12px;color:#9ca3af;">This quote was sent by ${escapeHtml(workspace.name)}</p>
    </div>
  </div>
</body>
</html>`;

    const pdf = await renderDocumentPdf({
      kind: 'quote',
      number: quote.quoteNumber,
      status: quote.status,
      workspaceName: workspace.name,
      clientName: quote.clientName,
      clientEmail: quote.clientEmail,
      clientPhone: quote.clientPhone,
      clientCompany: quote.clientCompany,
      clientAddress: quote.clientAddress,
      issueDate: quote.issueDate,
      secondaryDate: quote.validUntil,
      currency: quote.currency,
      items: quote.items,
      subtotal: quote.subtotal,
      discountAmount: quote.discountAmount,
      taxRate: quote.taxRate,
      taxAmount: quote.taxAmount,
      total: quote.total,
      notes: quote.notes,
      terms: quote.terms,
    });

    await sendDocumentEmail({
      sendFrom,
      workspaceId: workspace.id,
      workspaceName: workspace.name,
      replyTo: session.user.email,
      to: recipientEmail,
      subject: subject || `Quote ${quote.quoteNumber} from ${workspace.name}`,
      html: emailHtml,
      attachments: [
        {
          filename: pdfFilename({ number: quote.quoteNumber }),
          content: pdf,
          contentType: 'application/pdf',
        },
      ],
    });

    // Update quote status to 'sent'
    const updatedQuote = await prisma.quote.update({
      where: { id: params.id },
      data: {
        status: quote.status === 'draft' ? 'sent' : quote.status,
        sentAt: new Date(),
        updatedBy: session.user.id,
      },
    });

    return NextResponse.json({
      success: true,
      message: `Quote sent to ${recipientEmail}`,
      quote: updatedQuote,
    });
  } catch (error) {
    if (error instanceof DocumentEmailError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error sending quote:', error);
    return NextResponse.json({ error: 'Failed to send quote' }, { status: 500 });
  }
}
