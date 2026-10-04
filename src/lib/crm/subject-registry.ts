/**
 * Subject loaders.
 *
 * The criteria evaluator is deliberately type-blind (src/lib/crm/criteria.ts):
 * it reads dotted paths off whatever object it is handed. Deciding *which* rows
 * to hand it, with which relations included, is this module's job -- one loader
 * per subject type, so adding a subject means adding a loader rather than
 * editing a switch in the segmentation service, the automation engine and the
 * campaign sender.
 *
 * The `include` shape of each loader is load-bearing: it is exactly what makes a
 * dotted criterion resolve. A criterion on `pipeline.name` only works because
 * the Lead loader includes the pipeline.
 *
 * Server-only (imports prisma). Client code wants src/lib/crm/subjects.ts.
 */

import { prisma } from '@/lib/prisma'
import type { MergeContext } from '@/lib/email/render'
import { ServiceError } from '@/lib/services/errors'
import type { SubjectType } from '@/lib/crm/subjects'
import { daysOnMarket, parseStages } from '@/lib/crm/lifecycle'

/** The contact a campaign or an automation step actually mails. */
export interface SubjectRecipient {
  email: string
  name: string
  /** Written to EmailRecipient.leadId. Null only for subjects with no contact. */
  leadId: string | null
}

export interface SubjectLoader {
  /**
   * Every row of this subject in the workspace, shaped so dotted-path criteria
   * resolve. Used by segment materialization, which evaluates in JS because the
   * operator vocabulary (case-insensitive `in`, same-day date equality, dotted
   * paths into JSON) does not translate to a Prisma `where`.
   */
  loadAll(workspaceId: string): Promise<any[]>
  /** The same shape, by ids, in one query. Used by campaign recipient resolution. */
  loadMany(ids: string[]): Promise<any[]>
  /** The same shape, by id, plus the workspace. Used by the automation engine. */
  loadOne(id: string): Promise<{ row: any; workspaceId: string } | null>
  /** Who to mail, or null when this row is unreachable (no address, no contact). */
  recipient(row: any): SubjectRecipient | null
  /** SegmentMember.score. Null when nothing meaningfully ranks this subject. */
  score(row: any): number | null
  /** The merge-tag namespaces this subject contributes. */
  mergeContext(row: any): Partial<MergeContext>
  /** Display label for notifications and activity descriptions. */
  label(row: any): string
}

/**
 * Leads: an enquiry not yet attached to a property, plus the contact record every
 * other subject resolves back to.
 *
 * Scoped through the pipeline because Lead has no workspaceId of its own -- the
 * one subject where that is true, which is why the newer tables all carry one.
 */
const leadLoader: SubjectLoader = {
  loadAll: (workspaceId) =>
    prisma.lead.findMany({
      where: { pipeline: { workspaceId } },
      include: { pipeline: true },
    }),

  loadMany: (ids) =>
    prisma.lead.findMany({
      where: { id: { in: ids } },
      include: { pipeline: true },
    }),

  async loadOne(id) {
    const row = await prisma.lead.findUnique({
      where: { id },
      include: { pipeline: true },
    })
    return row ? { row, workspaceId: row.pipeline.workspaceId } : null
  },

  recipient(row) {
    if (!row?.email) return null
    return {
      email: row.email,
      name: `${row.firstName || ''} ${row.lastName || ''}`.trim(),
      leadId: row.id,
    }
  },

  // The scoring heuristic that used to live in EmailSegmentationService as
  // calculateLeadScore. Unchanged, now one subject's opinion rather than the
  // segmentation service's only opinion.
  score(row) {
    let score = 0

    const statusScores: Record<string, number> = {
      new: 10,
      contacted: 20,
      qualified: 40,
      proposal: 60,
      negotiation: 80,
      won: 100,
      lost: 0,
    }

    score += statusScores[row.status] || 0

    if (row.value) {
      score += Math.min(Math.floor(row.value / 1000), 50)
    }

    if (row.stage === 'proposal' || row.stage === 'negotiation') {
      score += 20
    }

    if (row.email) score += 10
    if (row.phone) score += 10
    if (row.company) score += 10

    return Math.min(score, 100)
  },

  mergeContext: (row) => ({ lead: row }),

  label: (row) => `${row.firstName || ''} ${row.lastName || ''}`.trim() || 'Prospect',
}

/** "First Last" of a lead-shaped contact, or '' when there is none. */
function contactName(lead: any): string {
  return `${lead?.firstName || ''} ${lead?.lastName || ''}`.trim()
}

/** A contact as a recipient, or null when it has no address. */
function leadRecipient(lead: any): SubjectRecipient | null {
  if (!lead?.email) return null
  return { email: lead.email, name: contactName(lead), leadId: lead.id }
}

const DAY_MS = 86_400_000

/**
 * Properties: the listing, and the card on the owner board.
 *
 * Its contact is the vendor, so a segment of properties ("live listings in
 * Lisbon over 500k") can be mailed -- to the people selling them. A property
 * whose vendor is not recorded yet has nobody to mail and resolves to null.
 *
 * Rows gain a computed `daysOnMarket` so a criterion can say "on the market more
 * than 60 days" without the evaluator learning about dates.
 */
const propertyInclude = { vendor: true, pipeline: true } as const
const withPropertyDerived = (row: any) => ({ ...row, daysOnMarket: daysOnMarket(row.listedAt) })

const propertyLoader: SubjectLoader = {
  async loadAll(workspaceId) {
    const rows = await prisma.property.findMany({ where: { workspaceId }, include: propertyInclude })
    return rows.map(withPropertyDerived)
  },
  async loadMany(ids) {
    const rows = await prisma.property.findMany({ where: { id: { in: ids } }, include: propertyInclude })
    return rows.map(withPropertyDerived)
  },
  async loadOne(id) {
    const row = await prisma.property.findUnique({ where: { id }, include: propertyInclude })
    return row ? { row: withPropertyDerived(row), workspaceId: row.workspaceId } : null
  },
  recipient: (row) => leadRecipient(row.vendor),
  // Freshness: a new listing ranks high and a stale one sinks. The only
  // workspace-independent ranking a listing has.
  score(row) {
    const days = row.daysOnMarket
    return days === null || days === undefined ? 50 : Math.max(0, 100 - days)
  },
  mergeContext: (row) => ({ lead: row.vendor ?? null, property: row }),
  label: (row) => row.title || row.reference || 'Property',
}

/**
 * Interests: one buyer's journey on one property.
 *
 * Resolves to the buyer. The row carries both `lead` and `property`, so a
 * criterion can reach `property.city` or `lead.email` from the one subject.
 */
const interestInclude = { lead: true, property: true, pipeline: true } as const

const interestLoader: SubjectLoader = {
  loadAll: (workspaceId) => prisma.interest.findMany({ where: { workspaceId }, include: interestInclude }),
  loadMany: (ids) => prisma.interest.findMany({ where: { id: { in: ids } }, include: interestInclude }),
  async loadOne(id) {
    const row = await prisma.interest.findUnique({ where: { id }, include: interestInclude })
    return row ? { row, workspaceId: row.workspaceId } : null
  },
  recipient: (row) => leadRecipient(row.lead),
  // How far down the funnel the buyer is, as a percentage of its columns.
  score(row) {
    const stages = parseStages(row.pipeline?.stages)
    if (stages.length < 2) return null
    const index = stages.findIndex(s => s.trim().toLowerCase() === String(row.stage).trim().toLowerCase())
    return index < 0 ? null : Math.round((index / (stages.length - 1)) * 100)
  },
  mergeContext: (row) => ({ lead: row.lead, property: row.property, interest: row }),
  label: (row) => [contactName(row.lead), row.property?.title].filter(Boolean).join(' · ') || 'Interest',
}

/**
 * Mandates: the authority to sell.
 *
 * Resolves to the vendor. Rows gain `daysToExpiry` (negative once expired), the
 * number the renewal work queue and the "expiring within 30 days" segment read,
 * alongside the raw `endDate` for criteria that compare dates directly.
 */
const mandateInclude = { lead: true, property: true } as const
const withMandateDerived = (row: any) => ({
  ...row,
  daysToExpiry: row.endDate ? Math.ceil((new Date(row.endDate).getTime() - Date.now()) / DAY_MS) : null,
})

const mandateLoader: SubjectLoader = {
  async loadAll(workspaceId) {
    const rows = await prisma.mandate.findMany({ where: { workspaceId }, include: mandateInclude })
    return rows.map(withMandateDerived)
  },
  async loadMany(ids) {
    const rows = await prisma.mandate.findMany({ where: { id: { in: ids } }, include: mandateInclude })
    return rows.map(withMandateDerived)
  },
  async loadOne(id) {
    const row = await prisma.mandate.findUnique({ where: { id }, include: mandateInclude })
    return row ? { row: withMandateDerived(row), workspaceId: row.workspaceId } : null
  },
  recipient: (row) => leadRecipient(row.lead),
  // Nothing meaningfully ranks a mandate.
  score: () => null,
  mergeContext: (row) => ({ lead: row.lead, property: row.property, mandate: row }),
  label: (row) => row.reference || row.property?.title || 'Mandate',
}

/**
 * One loader per subject type. Exhaustive on purpose: adding a subject to
 * SUBJECT_TYPES is a compile error here until it has a loader, so a segment can
 * never be saved over a subject the server cannot load.
 */
export const SUBJECT_LOADERS: Record<SubjectType, SubjectLoader> = {
  Lead: leadLoader,
  Property: propertyLoader,
  Interest: interestLoader,
  Mandate: mandateLoader,
}

export function loaderFor(type: SubjectType): SubjectLoader {
  const loader = SUBJECT_LOADERS[type]
  if (!loader) {
    throw new ServiceError(`No subject loader for '${type}'`, 400)
  }
  return loader
}

/** True for every current subject type; kept so callers can stay defensive. */
export function hasLoader(type: SubjectType): boolean {
  return Boolean(SUBJECT_LOADERS[type])
}
