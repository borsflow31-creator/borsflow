import { prisma } from '@/lib/prisma'
import { CrmLogger } from '@/lib/crm/logger'
import { onSubjectCreated } from '@/lib/crm/subject-events'
import { isSendable } from '@/lib/email/suppression'
import { createLead } from './leads'
import { createInterest } from './interests'
import { resolveBoard } from './pipelines'
import { ServiceError } from './errors'

/**
 * Enquiry intake: the one door.
 *
 * A website form and an agent typing in a phone call both land here, so an
 * enquiry means the same thing wherever it came from. It reuses
 * createLead (stage defaulting, list validation, value parsing, ordering) rather
 * than writing a lead by hand, then does what createLead does not: attaches the
 * buyer to the property they named, logs the activity, and fires the
 * `lead_created` automations.
 *
 * Two rules matter more than the rest because intake is where untrusted input
 * enters:
 *
 *  - It de-duplicates by address. A buyer who enquires on three properties is one
 *    contact with three interests, not three contacts. A repeat enquiry adds an
 *    interest and a note to the existing lead.
 *  - It cannot resurrect a suppressed address. The lead is still recorded (the
 *    agent should know someone enquired), but no automation is started for an
 *    address that has unsubscribed or bounced; the send path re-checks anyway.
 */

export type EnquiryChannel = 'website' | 'manual'

export interface EnquiryInput {
  workspaceId: string
  channel: EnquiryChannel
  firstName?: string | null
  lastName?: string | null
  email?: string | null
  phone?: string | null
  message?: string | null
  /** The property enquired about, by id or by the agency's reference. */
  propertyId?: string | null
  propertyReference?: string | null
  /** The agent entering it, for the manual channel. Otherwise the workspace owner is credited. */
  actorId?: string | null
}

export interface EnquiryResult {
  leadId: string
  interestId: string | null
  /** False when the enquirer was already a contact. */
  created: boolean
  /** True when the address is unsubscribed or suppressed, so no sequence was started. */
  suppressed: boolean
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

const clip = (value: unknown, max: number): string | null => {
  if (typeof value !== 'string') return null
  const trimmed = value.trim().slice(0, max)
  return trimmed || null
}

export async function receiveEnquiry(input: EnquiryInput): Promise<EnquiryResult> {
  const email = clip(input.email, 254)?.toLowerCase() ?? null
  const phone = clip(input.phone, 40)
  if (email && !EMAIL.test(email)) throw new ServiceError('Enter a valid email address')
  if (!email && !phone) throw new ServiceError('An email address or a phone number is required')

  let firstName = clip(input.firstName, 100)
  const lastName = clip(input.lastName, 100) ?? ''
  // A name is not required to get an enquiry; the address is. Fall back to the
  // part before the @ so the card is not blank.
  if (!firstName) firstName = email ? email.split('@')[0] : phone!
  const message = clip(input.message, 5000)

  const workspace = await prisma.workspace.findUnique({ where: { id: input.workspaceId }, select: { id: true, ownerId: true } })
  if (!workspace) throw new ServiceError('Workspace not found', 404)
  const actorId = input.actorId ?? workspace.ownerId

  // The property they asked about. An unknown reference on a public form is not
  // an error: the enquiry still matters, it just is not attached.
  const propertyId = clip(input.propertyId, 100)
  const propertyReference = clip(input.propertyReference, 60)
  const property = propertyId || propertyReference
    ? await prisma.property.findFirst({
        where: {
          workspaceId: workspace.id,
          ...(propertyId ? { id: propertyId } : { reference: propertyReference! }),
        },
        select: { id: true, title: true },
      })
    : null

  // De-duplicate by address within the workspace.
  const existing = email
    ? await prisma.lead.findFirst({
        where: { pipeline: { workspaceId: workspace.id }, email: { equals: email, mode: 'insensitive' } },
        select: { id: true },
      })
    : null

  const source = input.channel === 'website' ? 'website' : 'manual'

  let leadId: string
  let created = false
  if (existing) {
    leadId = existing.id
  } else {
    const board = await resolveBoard(workspace.id, 'Lead')
    const pipeline = await prisma.pipeline.findUniqueOrThrow({
      where: { id: board.id },
      select: { id: true, workspaceId: true, stages: true },
    })
    const lead = await createLead(pipeline, { firstName, lastName, email, phone, source, notes: message })
    leadId = lead.id
    created = true
    await CrmLogger.logCreated({
      workspaceId: workspace.id,
      userId: actorId,
      leadId,
      leadName: `${firstName} ${lastName}`.trim(),
      source,
    })
  }

  // What they wrote, on the timeline, for a new lead and a repeat one alike.
  if (message) {
    await CrmLogger.logActivity(
      workspace.id,
      actorId,
      'note_added',
      leadId,
      message,
      { body: message, channel: input.channel, source },
      leadId
    )
  }

  let interestId: string | null = null
  if (property) {
    try {
      const interest = await createInterest(
        { workspaceId: workspace.id, userId: actorId },
        { leadId, propertyId: property.id, source: 'enquiry' }
      )
      interestId = interest.id
    } catch (error) {
      // Already attached: a repeat enquiry on the same property. Not a failure.
      if (!(error instanceof ServiceError && error.status === 409)) throw error
      const current = await prisma.interest.findUnique({ where: { propertyId_leadId: { propertyId: property.id, leadId } }, select: { id: true } })
      interestId = current?.id ?? null
    }
  }

  const suppressed = email ? !(await isSendable(email, workspace.id)) : false
  if (created && !suppressed) {
    const lead = await prisma.lead.findUniqueOrThrow({ where: { id: leadId }, select: { pipelineId: true } })
    await onSubjectCreated({ subjectType: 'Lead', subjectId: leadId, pipelineId: lead.pipelineId, workspaceId: workspace.id })
  }

  return { leadId, interestId, created, suppressed }
}
