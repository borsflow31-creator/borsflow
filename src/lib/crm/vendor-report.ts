import { prisma } from '@/lib/prisma'
import { escapeHtml } from '@/lib/html'
import { VERDICT_DIMENSIONS, daysOnMarket } from '@/lib/crm/lifecycle'
import { mintToken } from '@/lib/crm/public-links'
import { emailFrame, queueDirectEmail } from '@/lib/email/direct'

/**
 * The vendor report: what an agency owes the person selling, on a schedule.
 *
 * An exclusive mandate is an exchange: the vendor gives the agency sole authority
 * to sell, and the agency owes them regular proof it is working -- enquiries,
 * viewings, what viewers said, offers, and where the price sits. The same numbers
 * back the report page the vendor opens and the email that points them at it.
 *
 * Buyers are never named. The vendor is told how many people enquired and what
 * they thought, not who they are: that is the agency's contact book, not the
 * vendor's.
 */

export interface VendorReport {
  mandate: { reference: string; mandateType: string; status: string; startDate: string | null; endDate: string | null }
  property: { title: string; city: string; reference: string; status: string; price: number; currency: string | null; daysOnMarket: number | null }
  agency: string
  priceHistory: { fromPrice: number; toPrice: number; changedAt: string }[]
  enquiries: number
  viewings: { total: number; withFeedback: number; averageInterest: number | null }
  feedback: Record<string, { negative: number; neutral: number; positive: number }>
  offers: { total: number; pending: number; highest: number | null }
  pricePosition: { comparables: number; percentile: number | null; thisPerSqm: number | null; medianPerSqm: number | null } | null
  generatedAt: string
}

/** Where this property's price per m2 sits among comparable live stock in the agency. */
async function pricePosition(property: {
  id: string; workspaceId: string; city: string; propertyType: string; price: number; surfaceArea: number | null
}): Promise<VendorReport['pricePosition']> {
  if (!property.surfaceArea || property.price <= 0) return null

  const comps = await prisma.property.findMany({
    where: {
      workspaceId: property.workspaceId,
      id: { not: property.id },
      city: { equals: property.city, mode: 'insensitive' },
      propertyType: property.propertyType,
      status: { in: ['live', 'under_offer'] },
      price: { gt: 0 },
      surfaceArea: { gt: 0 },
    },
    select: { price: true, surfaceArea: true },
  })

  const per = comps.map(c => c.price / c.surfaceArea!).sort((a, b) => a - b)
  const thisPerSqm = property.price / property.surfaceArea
  if (per.length < 3) return { comparables: per.length, percentile: null, thisPerSqm: Math.round(thisPerSqm), medianPerSqm: null }

  const cheaper = per.filter(p => p < thisPerSqm).length
  const mid = Math.floor(per.length / 2)
  const median = per.length % 2 ? per[mid] : (per[mid - 1] + per[mid]) / 2
  return {
    comparables: per.length,
    // Share of comparable stock that is cheaper per m2: 80 means "dearer than 80% of it".
    percentile: Math.round((cheaper / per.length) * 100),
    thisPerSqm: Math.round(thisPerSqm),
    medianPerSqm: Math.round(median),
  }
}

export async function buildVendorReport(mandateId: string): Promise<VendorReport | null> {
  const mandate = await prisma.mandate.findUnique({
    where: { id: mandateId },
    include: {
      property: true,
      workspace: { select: { name: true } },
      priceChanges: { orderBy: { changedAt: 'asc' } },
    },
  })
  if (!mandate) return null

  const since = mandate.startDate ?? mandate.createdAt
  const propertyId = mandate.propertyId

  const [enquiries, viewings, feedback, offers] = await Promise.all([
    prisma.interest.count({ where: { propertyId, createdAt: { gte: since } } }),
    prisma.meeting.count({ where: { propertyId, startTime: { gte: since }, status: { notIn: ['cancelled'] } } }),
    prisma.viewingFeedback.findMany({
      where: { propertyId, attended: true, createdAt: { gte: since } },
      select: { interestLevel: true, priceVerdict: true, conditionVerdict: true, locationVerdict: true, layoutVerdict: true },
    }),
    prisma.offer.findMany({ where: { propertyId, offeredAt: { gte: since } }, select: { amount: true, status: true } }),
  ])

  const verdicts = Object.fromEntries(
    VERDICT_DIMENSIONS.map(d => [d, { negative: 0, neutral: 0, positive: 0 }])
  ) as VendorReport['feedback']
  const levels: number[] = []
  for (const f of feedback) {
    if (f.interestLevel != null) levels.push(f.interestLevel)
    for (const d of VERDICT_DIMENSIONS) {
      const v = f[`${d}Verdict` as keyof typeof f] as 'negative' | 'neutral' | 'positive' | null
      if (v) verdicts[d][v]++
    }
  }

  const live = offers.filter(o => !['withdrawn', 'expired'].includes(o.status))
  return {
    mandate: {
      reference: mandate.reference,
      mandateType: mandate.mandateType,
      status: mandate.status,
      startDate: mandate.startDate?.toISOString() ?? null,
      endDate: mandate.endDate?.toISOString() ?? null,
    },
    property: {
      title: mandate.property.title,
      city: mandate.property.city,
      reference: mandate.property.reference,
      status: mandate.property.status,
      price: mandate.property.price,
      currency: mandate.property.currency,
      daysOnMarket: daysOnMarket(mandate.property.listedAt),
    },
    agency: mandate.workspace.name,
    priceHistory: mandate.priceChanges.map(c => ({ fromPrice: c.fromPrice, toPrice: c.toPrice, changedAt: c.changedAt.toISOString() })),
    enquiries,
    viewings: {
      total: viewings,
      withFeedback: feedback.length,
      averageInterest: levels.length ? Math.round((levels.reduce((a, b) => a + b, 0) / levels.length) * 10) / 10 : null,
    },
    feedback: verdicts,
    offers: {
      total: live.length,
      pending: offers.filter(o => o.status === 'pending').length,
      highest: live.length ? Math.max(...live.map(o => o.amount)) : null,
    },
    pricePosition: await pricePosition(mandate.property),
    generatedAt: new Date().toISOString(),
  }
}

/**
 * Send the report to every vendor who is due one: an active mandate with a
 * schedule whose last report is older than the interval.
 *
 * Each mandate is claimed with a conditional update on `lastReportSentAt` before
 * anything is built or sent, so two overlapping cron runs cannot both send. A
 * failure after the claim puts the old value back, so the vendor is retried on the
 * next run instead of silently skipped for a whole interval.
 */
export async function sendDueVendorReports(now = new Date()): Promise<{ sent: number; skipped: number }> {
  const candidates = await prisma.mandate.findMany({
    where: { status: 'active', reportEveryDays: { not: null } },
    select: {
      id: true, workspaceId: true, reportEveryDays: true, lastReportSentAt: true, leadId: true, reference: true,
      lead: { select: { firstName: true, lastName: true, email: true } },
      property: { select: { title: true } },
    },
    take: 500,
  })

  let sent = 0
  let skipped = 0
  for (const m of candidates) {
    const every = m.reportEveryDays! * 86_400_000
    if (m.lastReportSentAt && now.getTime() - m.lastReportSentAt.getTime() < every) { skipped++; continue }
    if (!m.lead.email) { skipped++; continue }

    const claimed = await prisma.mandate.updateMany({
      where: { id: m.id, lastReportSentAt: m.lastReportSentAt },
      data: { lastReportSentAt: now },
    })
    if (claimed.count === 0) { skipped++; continue }

    try {
      const report = await buildVendorReport(m.id)
      if (!report) throw new Error('report could not be built')
      const { url } = await mintToken('mandate', m.id)

      const money = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: report.property.currency || 'USD', maximumFractionDigits: 0 }).format(n)
      const line = (label: string, value: string | number) =>
        `<tr><td style="padding:6px 0;color:#52566b;">${escapeHtml(label)}</td><td style="padding:6px 0;text-align:right;"><strong>${escapeHtml(String(value))}</strong></td></tr>`

      const html = emailFrame(
        `Your sale update: ${report.property.title}`,
        `<p style="margin:0 0 16px;">Hello ${escapeHtml(m.lead.firstName)}, here is where things stand on ${escapeHtml(report.property.title)}.</p>
  <table style="width:100%;border-collapse:collapse;font-size:14px;">
    ${line('Asking price', money(report.property.price))}
    ${line('Days on the market', report.property.daysOnMarket ?? '-')}
    ${line('Enquiries', report.enquiries)}
    ${line('Viewings', report.viewings.total)}
    ${line('Offers', report.offers.total)}
  </table>
  <p style="margin:20px 0 0;"><a href="${url}" style="display:inline-block;padding:10px 18px;background:#1c1e2b;color:#fff;border-radius:6px;text-decoration:none;">See the full report</a></p>`
      )

      const queued = await queueDirectEmail({
        workspaceId: m.workspaceId,
        leadId: m.leadId,
        email: m.lead.email,
        name: `${m.lead.firstName} ${m.lead.lastName}`.trim(),
        subject: `Sale update: ${report.property.title}`,
        html,
        text: `Sale update for ${report.property.title}: ${report.enquiries} enquiries, ${report.viewings.total} viewings, ${report.offers.total} offers. Full report: ${url}`,
      })
      // Suppressed or unsubscribed: nothing was sent, and nothing will be until they opt back in.
      if (queued) sent++
      else skipped++
    } catch (error) {
      console.error(`[vendor-report] mandate ${m.id} failed:`, error)
      await prisma.mandate.updateMany({ where: { id: m.id, lastReportSentAt: now }, data: { lastReportSentAt: m.lastReportSentAt } })
    }
  }
  return { sent, skipped }
}
