import { NextRequest, NextResponse } from 'next/server'
import { getDeveloperAccess } from '@/lib/crm/access'
import { failure } from '@/lib/api/respond'
import { getReceiptData } from '@/lib/services/developer/collections'
import { renderReceiptPdf } from '@/lib/documents/receipt-pdf'
import { prisma } from '@/lib/prisma'
import { parseLocale, serverTranslator } from '@/i18n/server'

// React-PDF needs Node APIs, not the edge runtime.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * The receipt of a confirmed payment, as a PDF. Re-rendered from the stored row
 * on every request, so downloading it again never records anything.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const workspaceId = request.nextUrl.searchParams.get('workspaceId')
    if (!workspaceId) return NextResponse.json({ error: 'Workspace ID is required' }, { status: 400 })

    const result = await getDeveloperAccess(workspaceId)
    if ('error' in result) return result.error
    const { access } = result

    const data = await getReceiptData({ workspaceId, userId: access.userId }, id)
    const user = await prisma.user.findUnique({ where: { id: access.userId }, select: { locale: true } })
    const lang = parseLocale(user?.locale) ?? 'fr'
    // Arabic prints right to left in the bundled Arabic font, with Latin digits as used in the Maghreb.
    const rtl = lang === 'ar'
    const locale = rtl ? 'ar-u-nu-latn' : lang
    const t = await serverTranslator(lang)

    const { payment, call } = data
    const buyer = call.lot.buyerLead
    const pdf = await renderReceiptPdf(
      {
        receiptNumber: payment.receiptNumber!,
        status: payment.status,
        workspaceName: data.workspace.name,
        currency: data.workspace.currency,
        locale,
        rtl,
        buyer: {
          name: buyer ? `${buyer.firstName} ${buyer.lastName ?? ''}`.trim() : '—',
          email: buyer?.email,
          phone: buyer?.phone,
        },
        programName: call.lot.program.name,
        programReference: call.lot.program.reference,
        lotNumber: call.lot.lotNumber,
        contractNumber: call.lot.salesDocuments[0]?.number ?? null,
        callNumber: call.callNumber,
        milestoneTitle: call.isDeposit ? t('developerSales.payments.depositRow') : call.milestone.title,
        isDeposit: call.isDeposit,
        paymentDate: payment.paymentDate,
        amount: payment.amount,
        method: payment.paymentMethod,
        reference: payment.referenceNumber,
        recordedBy: payment.createdBy?.name ?? null,
        confirmedAt: payment.confirmedAt,
        remainingOnCall: data.remainingOnCall,
        remainingOnContract: data.remainingOnContract,
        reversalReason: payment.reversalReason,
      },
      t
    )

    const filename = `${payment.receiptNumber!.replace(/[^A-Za-z0-9._-]/g, '_')}.pdf`
    const disposition = request.nextUrl.searchParams.get('download') ? 'attachment' : 'inline'
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `${disposition}; filename="${filename}"`,
        'Cache-Control': 'private, no-store',
      },
    })
  } catch (error) {
    return failure(error, 'Failed to generate the receipt', 'Error generating receipt')
  }
}
