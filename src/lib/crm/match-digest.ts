import { prisma } from '@/lib/prisma'
import { escapeHtml } from '@/lib/html'
import { consumeUsage, releaseUsage } from '@/lib/billing/entitlements'
import { emailFrame, queueDirectEmail } from '@/lib/email/direct'
import { mintToken } from '@/lib/crm/public-links'
import { DEFAULT_CURRENCY } from '@/lib/currencies'

/**
 * Mail buyers about the properties that suit them, one digest per buyer.
 *
 * This is deliberately not sent from the moment a listing goes live. A vendor
 * bulk-loading thirty flats would otherwise send one buyer thirty emails; instead
 * onPropertyListed only records PropertyMatch rows, and this run -- on a cron --
 * gathers everything new for each buyer into a single message.
 *
 * Matches are claimed before the mail is composed (the same overlap guard
 * processDueEnrollments uses), so two cron runs cannot both send a buyer the same
 * digest; a failure puts the claim back so the buyer is retried, not skipped.
 */

const MAX_PROPERTIES_PER_DIGEST = 10
const BATCH = 300

export async function sendMatchDigests(): Promise<{ digests: number; matches: number; skipped: number }> {
  const pending = await prisma.propertyMatch.findMany({
    where: { status: 'new', searchBrief: { isActive: true, notifyByEmail: true }, property: { status: 'live' } },
    select: { id: true, leadId: true, workspaceId: true },
    orderBy: { createdAt: 'asc' },
    take: BATCH,
  })

  const byLead = new Map<string, { workspaceId: string; ids: string[] }>()
  for (const m of pending) {
    const group = byLead.get(m.leadId)
    if (group) group.ids.push(m.id)
    else byLead.set(m.leadId, { workspaceId: m.workspaceId, ids: [m.id] })
  }

  let digests = 0
  let matches = 0
  let skipped = 0

  for (const [leadId, group] of byLead) {
    const claimTime = new Date()
    const claimed = await prisma.propertyMatch.updateMany({
      where: { id: { in: group.ids }, status: 'new' },
      data: { status: 'notified', notifiedAt: claimTime },
    })
    if (claimed.count === 0) continue // another run has them

    const release = () =>
      prisma.propertyMatch.updateMany({
        where: { id: { in: group.ids }, status: 'notified', notifiedAt: claimTime },
        data: { status: 'new', notifiedAt: null },
      })

    try {
      const lead = await prisma.lead.findUnique({ where: { id: leadId }, select: { firstName: true, lastName: true, email: true } })
      if (!lead?.email) { skipped++; continue }

      const rows = await prisma.propertyMatch.findMany({
        where: { id: { in: group.ids }, notifiedAt: claimTime },
        orderBy: { score: 'desc' },
        take: MAX_PROPERTIES_PER_DIGEST,
        include: { property: true },
      })
      if (rows.length === 0) continue

      // One send, charged against the plan like any other.
      const usage = await consumeUsage(group.workspaceId, 'email_sends', 1)
      if (!usage.allowed) { await release(); skipped++; continue }

      const workspace = await prisma.workspace.findUnique({ where: { id: group.workspaceId }, select: { name: true, currency: true } })
      const currency = workspace?.currency || DEFAULT_CURRENCY
      const money = (n: number, c?: string | null) =>
        new Intl.NumberFormat('en-US', { style: 'currency', currency: c || currency, maximumFractionDigits: 0 }).format(n)

      const items: string[] = []
      for (const row of rows) {
        const p = row.property
        // A public link only for a property the agency has chosen to publish.
        const link = p.isPublished ? (await mintToken('property', p.id)).url : null
        const facts = [p.bedrooms != null ? `${p.bedrooms} bd` : null, p.surfaceArea != null ? `${p.surfaceArea} m²` : null].filter(Boolean).join(' · ')
        items.push(`<li style="margin:0 0 14px;">
    <strong>${escapeHtml(p.title)}</strong><br>
    <span style="color:#52566b;">${escapeHtml([p.district, p.city].filter(Boolean).join(', '))}${facts ? ` · ${escapeHtml(facts)}` : ''}</span><br>
    ${escapeHtml(money(p.price, p.currency))}${link ? ` · <a href="${link}">View</a>` : ''}
  </li>`)
      }

      const html = emailFrame(
        rows.length === 1 ? 'A new property for you' : `${rows.length} new properties for you`,
        `<p style="margin:0 0 16px;">Hello ${escapeHtml(lead.firstName)}, these just came on to the market and fit what you told us you are looking for.</p>
  <ul style="padding-left:18px;margin:0;">${items.join('')}</ul>
  <p style="margin:20px 0 0;color:#52566b;">Reply to this email and we will arrange a viewing.</p>`
      )

      const queued = await queueDirectEmail({
        workspaceId: group.workspaceId,
        leadId,
        email: lead.email,
        name: `${lead.firstName} ${lead.lastName}`.trim(),
        subject: rows.length === 1 ? `New on the market: ${rows[0].property.title}` : `${rows.length} new properties that match your search`,
        html,
        text: rows.map(r => `${r.property.title} - ${r.property.city} - ${money(r.property.price, r.property.currency)}`).join('\n'),
      })

      if (!queued) {
        // Suppressed or unsubscribed: nothing is sent, and the matches are not
        // retried forever -- they are set aside.
        await releaseUsage(group.workspaceId, 'email_sends', 1)
        await prisma.propertyMatch.updateMany({ where: { id: { in: group.ids }, notifiedAt: claimTime }, data: { status: 'dismissed', dismissedAt: claimTime } })
        skipped++
        continue
      }

      digests++
      matches += rows.length
    } catch (error) {
      console.error(`[match-digest] lead ${leadId} failed:`, error)
      await release()
    }
  }

  return { digests, matches, skipped }
}
