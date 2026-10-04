/**
 * The four things that move through a funnel in this product.
 *
 * Real-estate state is per (lead x property), so the engines cannot be keyed on
 * a lead. They operate on a typed subject instead:
 *
 *   Interest  one buyer's journey on one property -- the join row, and what
 *             actually moves across the buyer board
 *   Lead      an enquiry not yet attached to any property (nurture, qualification)
 *   Property  the listing's own lifecycle, independent of any buyer; the card
 *             on the owner (acquisition) board, with its vendor as its contact
 *   Mandate   the authority to sell, with its expiry clock; its contact is the
 *             vendor
 *
 * Pure data and type guards, no server imports, so the segment builder, the
 * board and the API routes all read the same vocabulary. Loading rows for a
 * subject lives in src/lib/crm/subject-registry.ts, which needs prisma.
 */

import type { MessageKey } from '@/i18n/I18nProvider'

/** Prisma model names, used verbatim as the stored discriminator. */
export const SUBJECT_TYPES = ['Lead', 'Property', 'Interest', 'Mandate'] as const
export type SubjectType = (typeof SUBJECT_TYPES)[number]

/** What a row with no subjectType means, and what every pre-existing row is. */
export const DEFAULT_SUBJECT_TYPE: SubjectType = 'Lead'

/**
 * Subjects that can be a kanban column set: enquiries (Lead), a buyer's journey
 * on one property (Interest), and the owner-acquisition funnel, whose card is the
 * Property (prospect -> valuation -> mandate signed -> live -> sold). A Mandate
 * is not a card: it is a record on a property with an expiry clock, worked from
 * a renewal queue rather than a board.
 */
export const PIPELINE_SUBJECT_TYPES = ['Lead', 'Property', 'Interest'] as const satisfies readonly SubjectType[]

/**
 * Subjects that can be enrolled in an automation. Every subject resolves to a
 * contact: a lead is itself one, an interest's is its buyer, a property's and a
 * mandate's is the vendor. A property whose vendor is not recorded yet simply has
 * nobody to enroll or mail -- the dispatcher skips it, it is not an error.
 */
export const AUTOMATABLE_SUBJECT_TYPES = ['Lead', 'Property', 'Interest', 'Mandate'] as const satisfies readonly SubjectType[]

/** Segments may be built over anything, including stock (for internal digests). */
export const SEGMENTABLE_SUBJECT_TYPES = SUBJECT_TYPES

export function isSubjectType(value: unknown): value is SubjectType {
  return typeof value === 'string' && (SUBJECT_TYPES as readonly string[]).includes(value)
}

/**
 * Coerce a stored discriminator. Falls back to 'Lead' rather than throwing:
 * these strings come out of columns that a migration or a hand-edit could leave
 * unexpected, and a segment resolving to the wrong subject is better than a 500.
 */
export function asSubjectType(value: unknown): SubjectType {
  return isSubjectType(value) ? value : DEFAULT_SUBJECT_TYPE
}

export function isAutomatable(type: SubjectType): boolean {
  return (AUTOMATABLE_SUBJECT_TYPES as readonly SubjectType[]).includes(type)
}

export function isPipelineSubject(type: SubjectType): boolean {
  return (PIPELINE_SUBJECT_TYPES as readonly SubjectType[]).includes(type)
}

/**
 * The single place the denormalized contact column on SegmentMember and
 * AutomationEnrollment is derived. Those tables carry a leadId alongside the
 * polymorphic (subjectType, subjectId) because it is the contact the row mails,
 * it carries the delete cascade, and it feeds EmailRecipient.leadId on every
 * send. A CHECK constraint in the database enforces the Lead case of the mapping
 * below (a lead's contact is itself), and Prisma cannot see CHECK constraints --
 * so route every write through here rather than building the row by hand, or the
 * insert will fail at runtime.
 */
export function contactLeadIdFor(subjectType: SubjectType, row: any): string | null {
  switch (subjectType) {
    case 'Lead':
      return row?.id ?? null
    case 'Interest':
      return row?.leadId ?? null // the buyer
    case 'Mandate':
      return row?.leadId ?? null // the vendor
    case 'Property':
      return row?.vendorId ?? null // the vendor, when recorded
  }
}

/** Where the client fetches rows of each subject. */
export const SUBJECT_ENDPOINTS: Record<SubjectType, string> = {
  Lead: '/api/leads',
  Property: '/api/properties',
  Interest: '/api/interests',
  Mandate: '/api/mandates',
}

export interface SubjectField {
  /** A dotted path getFieldValue can resolve against the loader's row shape. */
  field: string
  labelKey: MessageKey
  type: 'text' | 'number' | 'date' | 'boolean' | 'enum'
  options?: string[]
}

/**
 * The fields the criteria builder offers per subject, and the allow-list the API
 * validates a saved criterion against.
 *
 * These must be real paths on the shape the matching subject loader returns --
 * criteria are evaluated against that object, so a field that does not exist
 * silently matches nothing. Computed fields (daysOnMarket, daysToExpiry) are
 * added by the loader, not stored.
 */
const f = (field: string, labelKey: MessageKey, type: SubjectField['type']): SubjectField => ({ field, labelKey, type })

export const SUBJECT_FIELDS: Record<SubjectType, SubjectField[]> = {
  Lead: [
    f('firstName', 'emailMarketing.segmentModal.fieldFirstName', 'text'),
    f('lastName', 'emailMarketing.segmentModal.fieldLastName', 'text'),
    f('email', 'emailMarketing.segmentModal.fieldEmail', 'text'),
    f('phone', 'emailMarketing.segmentModal.fieldPhone', 'text'),
    f('status', 'emailMarketing.segmentModal.fieldStatus', 'text'),
    f('stage', 'emailMarketing.segmentModal.fieldStage', 'text'),
    f('pipeline.name', 'emailMarketing.segmentModal.fieldPipelineName', 'text'),
    f('value', 'emailMarketing.segmentModal.fieldDealValue', 'number'),
    f('company', 'emailMarketing.segmentModal.fieldCompany', 'text'),
    f('position', 'emailMarketing.segmentModal.fieldPosition', 'text'),
    f('source', 'emailMarketing.segmentModal.fieldSource', 'text'),
    f('tags', 'emailMarketing.segmentModal.fieldTags', 'text'),
    f('createdAt', 'emailMarketing.segmentModal.fieldCreatedDate', 'date'),
    f('updatedAt', 'emailMarketing.segmentModal.fieldUpdatedDate', 'date'),
  ],
  Property: [
    f('reference', 'realEstate.fields.reference', 'text'),
    f('title', 'realEstate.fields.title', 'text'),
    f('propertyType', 'realEstate.fields.propertyType', 'text'),
    f('status', 'realEstate.fields.propertyStatus', 'text'),
    f('stage', 'realEstate.fields.stage', 'text'),
    f('pipeline.name', 'realEstate.fields.pipelineName', 'text'),
    f('price', 'realEstate.fields.price', 'number'),
    f('city', 'realEstate.fields.city', 'text'),
    f('district', 'realEstate.fields.district', 'text'),
    f('postalCode', 'realEstate.fields.postalCode', 'text'),
    f('countryCode', 'realEstate.fields.countryCode', 'text'),
    f('surfaceArea', 'realEstate.fields.surfaceArea', 'number'),
    f('rooms', 'realEstate.fields.rooms', 'number'),
    f('bedrooms', 'realEstate.fields.bedrooms', 'number'),
    f('bathrooms', 'realEstate.fields.bathrooms', 'number'),
    f('floor', 'realEstate.fields.floor', 'number'),
    f('buildYear', 'realEstate.fields.buildYear', 'number'),
    f('energyRating', 'realEstate.fields.energyRating', 'text'),
    f('hasParking', 'realEstate.fields.hasParking', 'boolean'),
    f('hasGarden', 'realEstate.fields.hasGarden', 'boolean'),
    f('daysOnMarket', 'realEstate.fields.daysOnMarket', 'number'),
    f('listedAt', 'realEstate.fields.listedAt', 'date'),
    f('vendor.email', 'realEstate.fields.vendorEmail', 'text'),
    f('createdAt', 'emailMarketing.segmentModal.fieldCreatedDate', 'date'),
  ],
  Interest: [
    f('stage', 'realEstate.fields.stage', 'text'),
    f('status', 'realEstate.fields.interestStatus', 'text'),
    f('source', 'emailMarketing.segmentModal.fieldSource', 'text'),
    f('pipeline.name', 'realEstate.fields.pipelineName', 'text'),
    f('lead.firstName', 'realEstate.fields.buyerFirstName', 'text'),
    f('lead.lastName', 'realEstate.fields.buyerLastName', 'text'),
    f('lead.email', 'realEstate.fields.buyerEmail', 'text'),
    f('property.title', 'realEstate.fields.propertyTitle', 'text'),
    f('property.city', 'realEstate.fields.propertyCity', 'text'),
    f('property.propertyType', 'realEstate.fields.propertyType', 'text'),
    f('property.status', 'realEstate.fields.propertyStatus', 'text'),
    f('property.price', 'realEstate.fields.propertyPrice', 'number'),
    f('lastActivityAt', 'realEstate.fields.lastActivityAt', 'date'),
    f('createdAt', 'emailMarketing.segmentModal.fieldCreatedDate', 'date'),
  ],
  Mandate: [
    f('reference', 'realEstate.fields.reference', 'text'),
    f('mandateType', 'realEstate.fields.mandateType', 'text'),
    f('status', 'realEstate.fields.mandateStatus', 'text'),
    f('startDate', 'realEstate.fields.startDate', 'date'),
    f('endDate', 'realEstate.fields.endDate', 'date'),
    f('daysToExpiry', 'realEstate.fields.daysToExpiry', 'number'),
    f('askingPrice', 'realEstate.fields.askingPrice', 'number'),
    f('commissionPercent', 'realEstate.fields.commissionPercent', 'number'),
    f('signedAt', 'realEstate.fields.signedAt', 'date'),
    f('lead.firstName', 'realEstate.fields.vendorFirstName', 'text'),
    f('lead.lastName', 'realEstate.fields.vendorLastName', 'text'),
    f('lead.email', 'realEstate.fields.vendorEmail', 'text'),
    f('property.title', 'realEstate.fields.propertyTitle', 'text'),
    f('property.city', 'realEstate.fields.propertyCity', 'text'),
    f('property.status', 'realEstate.fields.propertyStatus', 'text'),
  ],
}

export function subjectFields(type: SubjectType): SubjectField[] {
  return SUBJECT_FIELDS[type]
}
