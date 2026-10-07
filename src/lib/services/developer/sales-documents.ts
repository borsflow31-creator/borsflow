import { createHash } from 'crypto'
import { prisma } from '@/lib/prisma'
import { CrmLogger } from '@/lib/crm/logger'
import { getSupabaseAdmin, CRM_BUCKET } from '@/lib/supabase-admin'
import { emailParagraph, renderEmail, sendTransactionalEmail } from '@/lib/email'
import { escapeHtml } from '@/lib/html'
import { notify } from '@/lib/notifications/notify'
import {
  DEFAULT_TEMPLATES,
  isTemplateKind,
  placeholdersIn,
  renderTemplate,
  MERGE_FIELDS,
  type TemplateKind,
} from '@/lib/documents/sales-merge'
import { renderSalesPdf, salesPdfFilename } from '@/lib/documents/sales-pdf'
import { canViewDocument, isDocumentVisibility, visibleDocumentsWhere } from '@/lib/crm/document-access'
import { ServiceError } from '../errors'
import { readString } from '../parse'
import { lotNetPrice } from '../commissions'
import type { DeveloperContext } from './programs'
import { ensureLotPublicToken, updateLot } from './lots'
import { createTask } from './tasks'

const KIND_PREFIX = { reservation: 'RES', contract: 'CON' } as const
type DocumentKind = keyof typeof KIND_PREFIX

const appUrl = () => (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '')

/** The link a buyer opens to review and accept: their purchase space. */
export function buyerPortalUrl(publicToken: string): string {
  return `${appUrl()}/view/buyer/${publicToken}`
}

function isDocumentKind(v: unknown): v is DocumentKind {
  return v === 'reservation' || v === 'contract'
}

// ─── Templates ───────────────────────────────────────────────────────────────

export interface EffectiveTemplate {
  name: string
  subject: string | null
  body: string
  /** Where the wording came from, so the UI can say whether it is the built-in draft. */
  source: 'project' | 'workspace' | 'default'
}

/**
 * The wording to use for a sale: the project's own template if it has one, else the
 * workspace's, else the built-in draft. The built-in is a stand-in that says so in
 * its own text, so a workspace that never wrote one cannot send it unnoticed.
 */
export async function getEffectiveTemplate(
  workspaceId: string,
  programId: string | null,
  kind: TemplateKind
): Promise<EffectiveTemplate> {
  const rows = await prisma.salesTemplate.findMany({
    where: { workspaceId, kind, OR: [{ programId }, { programId: null }] },
    select: { programId: true, name: true, subject: true, body: true },
  })
  const project = programId ? rows.find((r) => r.programId === programId) : undefined
  const workspace = rows.find((r) => r.programId === null)
  const chosen = project ?? workspace
  if (chosen) {
    return { name: chosen.name, subject: chosen.subject, body: chosen.body, source: project ? 'project' : 'workspace' }
  }
  const fallback = DEFAULT_TEMPLATES[kind]
  return { ...fallback, source: 'default' }
}

export async function listTemplates(ctx: DeveloperContext) {
  return prisma.salesTemplate.findMany({
    where: { workspaceId: ctx.workspaceId },
    orderBy: [{ kind: 'asc' }, { programId: 'asc' }],
    include: { program: { select: { id: true, name: true } } },
  })
}

/**
 * Create or replace a template. A placeholder that does not exist is refused at
 * save, not at issue: the author is looking at the text now and can fix the typo,
 * whereas at issue time it would block a salesperson mid-sale.
 *
 * Upsert by hand: the unique index cannot hold for a workspace-wide template
 * (programId NULL is never equal to NULL in Postgres), so "one per kind" is kept
 * here.
 */
export async function saveTemplate(ctx: DeveloperContext, input: Record<string, unknown>) {
  const kind = readString(input, 'kind', 'Kind', { required: true })!
  if (!isTemplateKind(kind)) throw new ServiceError('Unknown template kind')
  const name = readString(input, 'name', 'Name', { required: true, max: 120 })!
  const body = readString(input, 'body', 'Wording', { required: true, max: 20000 })!
  const subject = readString(input, 'subject', 'Subject', { max: 200 }) ?? null
  const programId = readString(input, 'programId', 'Project') ?? null

  if (programId) {
    const program = await prisma.program.findFirst({ where: { id: programId, workspaceId: ctx.workspaceId }, select: { id: true } })
    if (!program) throw new ServiceError('Project not found in this workspace', 404)
  }

  const known = new Set<string>(MERGE_FIELDS)
  const unknown = placeholdersIn(`${subject ?? ''}\n${body}`).filter((p) => !known.has(p))
  if (unknown.length > 0) {
    throw new ServiceError(`These placeholders do not exist: ${unknown.map((u) => `{{${u}}}`).join(', ')}`)
  }

  const existing = await prisma.salesTemplate.findFirst({
    where: { workspaceId: ctx.workspaceId, kind, programId },
    select: { id: true },
  })
  return existing
    ? prisma.salesTemplate.update({ where: { id: existing.id }, data: { name, body, subject } })
    : prisma.salesTemplate.create({ data: { workspaceId: ctx.workspaceId, kind, programId, name, body, subject } })
}

export async function deleteTemplate(ctx: DeveloperContext, id: string) {
  const result = await prisma.salesTemplate.deleteMany({ where: { id, workspaceId: ctx.workspaceId } })
  if (result.count === 0) throw new ServiceError('Template not found', 404)
  return { success: true }
}

// ─── Values ──────────────────────────────────────────────────────────────────

const money = (n: number, currency: string) =>
  new Intl.NumberFormat('en', { style: 'currency', currency }).format(n)

const lotForValues = {
  id: true,
  lotNumber: true,
  type: true,
  typology: true,
  floor: true,
  surfaceArea: true,
  basePrice: true,
  discount: true,
  taxRate: true,
  totalPrice: true,
  reservationFee: true,
  status: true,
  buyerLeadId: true,
  publicToken: true,
  salesAgent: { select: { name: true, email: true } },
  buyerLead: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
  program: { select: { id: true, name: true, addressLine: true, postalCode: true, city: true, developerName: true } },
  workspace: { select: { name: true, currency: true } },
} as const

/** The facts of one sale, as the strings a template can place. */
export function saleValues(
  lot: NonNullable<Awaited<ReturnType<typeof loadLotForValues>>>,
  documentNumber?: string
): Record<string, string> {
  const currency = lot.workspace.currency || 'EUR'
  const buyer = lot.buyerLead
  return {
    document_number: documentNumber ?? '',
    date: new Date().toISOString().slice(0, 10),
    developer: lot.program.developerName || lot.workspace.name,
    buyer_name: buyer ? `${buyer.firstName} ${buyer.lastName}`.trim() : '',
    buyer_email: buyer?.email ?? '',
    buyer_phone: buyer?.phone ?? '',
    project: lot.program.name,
    project_address: [lot.program.addressLine, lot.program.postalCode, lot.program.city].filter(Boolean).join(', '),
    unit: lot.lotNumber,
    unit_type: lot.type,
    typology: lot.typology ?? '',
    floor: String(lot.floor),
    surface: String(lot.surfaceArea),
    list_price: money(lot.basePrice, currency),
    discount: money(lot.discount, currency),
    net_price: money(lotNetPrice(lot.totalPrice, lot.taxRate), currency),
    vat_rate: `${lot.taxRate}%`,
    final_price: money(lot.totalPrice, currency),
    reservation_fee: lot.reservationFee ? money(lot.reservationFee, currency) : '',
    agent: lot.salesAgent?.name || lot.salesAgent?.email || '',
  }
}

export function loadLotForValues(workspaceId: string, lotId: string) {
  return prisma.developmentLot.findFirst({ where: { id: lotId, workspaceId }, select: lotForValues })
}

// ─── Documents ───────────────────────────────────────────────────────────────

async function nextNumber(workspaceId: string, kind: DocumentKind, attempt: number): Promise<string> {
  const prefix = KIND_PREFIX[kind]
  const year = new Date().getUTCFullYear()
  // Void documents keep their numbers, so counting every row never reuses one.
  const count = await prisma.salesDocument.count({
    where: { workspaceId, kind, number: { startsWith: `${prefix}-${year}-` } },
  })
  return `${prefix}-${year}-${String(count + 1 + attempt).padStart(4, '0')}`
}

/**
 * The workspace's own view of a unit's documents. A managers-only document is not
 * in the list for anyone but an owner or admin.
 */
export function listDocumentsForLot(ctx: DeveloperContext, lotId: string, canModerate = false) {
  return prisma.salesDocument.findMany({
    where: { workspaceId: ctx.workspaceId, lotId, ...visibleDocumentsWhere(canModerate) },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true, kind: true, number: true, status: true, title: true, visibility: true, sentAt: true,
      acceptedAt: true, acceptedName: true, createdAt: true,
    },
  })
}

/**
 * Issue a reservation form or contract for a sale: merge the template with the
 * sale's facts and freeze the result.
 *
 * Only one live document of a kind exists per unit. Issuing again replaces one that
 * has not been accepted (it is voided, keeping its number and its record), and
 * refuses when one has been accepted -- a signed agreement is not quietly
 * superseded; the sale would have to be cancelled first.
 */
export async function issueDocument(ctx: DeveloperContext, lotId: string, kindInput: unknown) {
  if (!isDocumentKind(kindInput)) throw new ServiceError('Unknown document kind')
  const kind = kindInput

  const lot = await loadLotForValues(ctx.workspaceId, lotId)
  if (!lot) throw new ServiceError('Lot not found', 404)
  if (!lot.buyerLeadId || !lot.buyerLead) throw new ServiceError('Reserve the unit for a buyer before issuing a document', 400)
  if (lot.status === 'available' || lot.status === 'optioned') {
    throw new ServiceError('Only a reserved or sold unit can have a reservation form or contract', 400)
  }

  const accepted = await prisma.salesDocument.findFirst({ where: { lotId, kind, status: 'accepted' }, select: { number: true } })
  if (accepted) {
    throw new ServiceError(`${accepted.number} has already been accepted. Cancel the sale before issuing a new one.`, 409)
  }

  const template = await getEffectiveTemplate(ctx.workspaceId, lot.program.id, kind)

  let created: Awaited<ReturnType<typeof prisma.salesDocument.create>> | null = null
  let warnings: string[] = []
  for (let attempt = 0; attempt < 5 && !created; attempt++) {
    const number = await nextNumber(ctx.workspaceId, kind, attempt)
    const values = saleValues(lot, number)
    const merged = renderTemplate(template.body, values)
    if (merged.unknown.length > 0) {
      throw new ServiceError(`The template uses placeholders that do not exist: ${merged.unknown.map((u) => `{{${u}}}`).join(', ')}`)
    }
    warnings = merged.missing

    try {
      created = await prisma.$transaction(async (tx) => {
        // Replace an unaccepted one in the same transaction as the new one appears.
        await tx.salesDocument.updateMany({
          where: { lotId, kind, status: { in: ['draft', 'sent'] } },
          data: { status: 'void' },
        })
        return tx.salesDocument.create({
          data: {
            workspaceId: ctx.workspaceId,
            lotId,
            leadId: lot.buyerLeadId,
            kind,
            number,
            status: 'draft',
            title: template.name,
            bodyText: merged.text,
            data: { values, missing: merged.missing, templateSource: template.source },
            createdById: ctx.userId,
          },
        })
      })
    } catch (error: any) {
      // Another issue took this number between counting and inserting: try the next.
      if (error?.code !== 'P2002') throw error
    }
  }
  if (!created) throw new ServiceError('Could not allocate a document number. Please try again.', 409)

  return { document: created, warnings, templateSource: template.source }
}

function sha256(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex')
}

const documentPath = (workspaceId: string, leadId: string, docId: string) =>
  `crm/${workspaceId}/${leadId}/sales/${docId}.pdf`

const KIND_LABEL: Record<DocumentKind, string> = { reservation: 'Reservation form', contract: 'Sales contract' }

/**
 * Send a document to the buyer: render the PDF once, store it, fingerprint it, and
 * email it with a link to accept.
 *
 * The stored file and its hash are the record of what the buyer was shown, so the
 * PDF is written before the email goes and the document is marked sent only after
 * both succeed. If the email fails the document stays a draft and can be sent again;
 * the stored path is derived from the document id and overwritten on retry, so a
 * failed attempt leaves nothing stray.
 */
export async function sendDocument(ctx: DeveloperContext & { canModerate?: boolean }, documentId: string) {
  const doc = await prisma.salesDocument.findFirst({
    where: { id: documentId, workspaceId: ctx.workspaceId, ...visibleDocumentsWhere(ctx.canModerate ?? false) },
    include: {
      lead: { select: { id: true, firstName: true, lastName: true, email: true } },
      lot: { select: { id: true, lotNumber: true, program: { select: { name: true } }, workspace: { select: { name: true } } } },
    },
  })
  if (!doc) throw new ServiceError('Document not found', 404)
  if (doc.status === 'void') throw new ServiceError('A voided document cannot be sent', 409)
  if (doc.status === 'accepted') throw new ServiceError('This document has already been accepted', 409)
  if (!doc.lead?.email) throw new ServiceError('The buyer has no email address', 400)

  const supabase = getSupabaseAdmin()
  if (!supabase) throw new ServiceError('File storage is not configured', 500)

  const workspaceName = doc.lot.workspace.name
  const pdf = await renderSalesPdf({
    kind: doc.kind as DocumentKind,
    number: doc.number,
    title: doc.title,
    workspaceName,
    issuedAt: doc.createdAt,
    bodyText: doc.bodyText,
  })
  const hash = sha256(pdf)
  const path = documentPath(ctx.workspaceId, doc.lead.id, doc.id)

  const { error } = await supabase.storage.from(CRM_BUCKET).upload(path, pdf, { contentType: 'application/pdf', upsert: true })
  if (error) {
    console.error('[sales-documents] storage upload failed:', error.message)
    throw new ServiceError('Could not store the document', 500)
  }

  const token = await ensureLotPublicToken(doc.lot.id)
  const buyer = `${doc.lead.firstName} ${doc.lead.lastName}`.trim()
  try {
    await sendTransactionalEmail({
      to: doc.lead.email,
      subject: `${KIND_LABEL[doc.kind as DocumentKind]} ${doc.number} from ${workspaceName}`,
      senderName: workspaceName,
      html: renderEmail({
        title: `${KIND_LABEL[doc.kind as DocumentKind]} ${escapeHtml(doc.number)}`,
        preheader: `Please review and accept ${doc.number}.`,
        heading: `${KIND_LABEL[doc.kind as DocumentKind]} for unit ${escapeHtml(doc.lot.lotNumber)}`,
        body:
          emailParagraph(`Dear ${escapeHtml(buyer)},`) +
          emailParagraph(
            `Please review the attached ${escapeHtml(KIND_LABEL[doc.kind as DocumentKind].toLowerCase())} for unit <strong>${escapeHtml(doc.lot.lotNumber)}</strong> in <strong>${escapeHtml(doc.lot.program.name)}</strong>, and accept it in your purchase space.`
          ),
        action: { label: 'Review and accept', url: escapeHtml(buyerPortalUrl(token)) },
        note: 'You will be asked for a one-time code sent to this address.',
        footer: `Sent on behalf of ${escapeHtml(workspaceName)}.`,
      }),
      text: `Please review the attached ${KIND_LABEL[doc.kind as DocumentKind].toLowerCase()} and accept it here: ${buyerPortalUrl(token)}`,
      attachments: [{ filename: salesPdfFilename(doc), content: pdf, contentType: 'application/pdf' }],
    })
  } catch (error) {
    console.error('[sales-documents] email failed:', error)
    throw new ServiceError('We could not email the document. It is still a draft; please try again.', 502)
  }

  const updated = await prisma.salesDocument.update({
    where: { id: doc.id },
    data: { status: 'sent', sentAt: new Date(), pdfPath: path, contentHash: hash },
  })

  // Also a document on the buyer's file, so it shows beside everything else on them.
  const existingFile = await prisma.leadFile.findFirst({ where: { leadId: doc.lead.id, filePath: path }, select: { id: true } })
  if (existingFile) {
    await prisma.leadFile.update({ where: { id: existingFile.id }, data: { size: pdf.length } })
  } else {
    await prisma.leadFile.create({
      data: {
        leadId: doc.lead.id,
        workspaceId: ctx.workspaceId,
        filePath: path,
        fileName: salesPdfFilename(doc),
        fileType: 'application/pdf',
        size: pdf.length,
        uploadedById: ctx.userId,
        // The copy on the buyer's file is as private as the document it came from.
        visibility: doc.visibility,
      },
    })
  }

  await CrmLogger.logActivity(
    ctx.workspaceId,
    ctx.userId,
    'sales_document_sent',
    doc.lead.id,
    `${KIND_LABEL[doc.kind as DocumentKind]} ${doc.number} sent to ${buyer}`,
    { documentId: doc.id, number: doc.number, hash, ...(doc.visibility !== 'team' ? { visibility: doc.visibility } : {}) },
    doc.lead.id
  )

  return updated
}

export async function voidDocument(ctx: DeveloperContext & { canModerate?: boolean }, documentId: string) {
  const doc = await prisma.salesDocument.findFirst({
    where: { id: documentId, workspaceId: ctx.workspaceId, ...visibleDocumentsWhere(ctx.canModerate ?? false) },
    select: { status: true },
  })
  if (!doc) throw new ServiceError('Document not found', 404)
  if (doc.status === 'accepted') throw new ServiceError('An accepted document cannot be voided; cancel the sale instead', 409)
  return prisma.salesDocument.update({ where: { id: documentId }, data: { status: 'void' } })
}

/**
 * The PDF for a document. A draft is rendered fresh; a sent one is the stored file
 * the buyer received; an accepted one is rendered again with the acceptance page
 * appended, naming the fingerprint of the stored original.
 */
export async function getDocumentPdf(
  workspaceId: string,
  documentId: string,
  /** The buyer's view: this unit only, and only documents that were actually sent. */
  scope?: { lotId: string; issuedOnly?: boolean },
  /**
   * Set for a team member reading it: a managers-only document is then a 404.
   * Left out for the buyer's own portal, where visibility (an internal matter) does
   * not apply -- they are shown what was sent to them.
   */
  staff?: { canModerate: boolean }
) {
  const doc = await prisma.salesDocument.findFirst({
    where: {
      id: documentId,
      workspaceId,
      ...(scope ? { lotId: scope.lotId } : {}),
      ...(scope?.issuedOnly ? { status: { in: ['sent', 'accepted'] } } : {}),
    },
    include: { lot: { select: { workspace: { select: { name: true } } } } },
  })
  if (!doc || (staff && !canViewDocument(staff.canModerate, doc.visibility))) {
    throw new ServiceError('Document not found', 404)
  }

  const base = {
    kind: doc.kind as DocumentKind,
    number: doc.number,
    title: doc.title,
    workspaceName: doc.lot.workspace.name,
    issuedAt: doc.createdAt,
    bodyText: doc.bodyText,
  }

  if (doc.status === 'accepted' && doc.acceptedAt && doc.acceptedName && doc.acceptedHash) {
    const buffer = await renderSalesPdf({
      ...base,
      acceptance: { name: doc.acceptedName, at: doc.acceptedAt, ip: doc.acceptedIp, userAgent: doc.acceptedUserAgent, fileHash: doc.acceptedHash },
    })
    return { buffer, filename: salesPdfFilename(doc), status: doc.status }
  }

  if (doc.status === 'sent' && doc.pdfPath) {
    const stored = await downloadStored(doc.pdfPath)
    if (stored) return { buffer: stored, filename: salesPdfFilename(doc), status: doc.status }
  }

  return { buffer: await renderSalesPdf(base), filename: salesPdfFilename(doc), status: doc.status }
}

async function downloadStored(path: string): Promise<Buffer | null> {
  const supabase = getSupabaseAdmin()
  if (!supabase) return null
  const { data, error } = await supabase.storage.from(CRM_BUCKET).download(path)
  if (error || !data) return null
  return Buffer.from(await data.arrayBuffer())
}

/**
 * Change who can see a document. Owners and admins only, and the copy on the buyer's
 * file moves with it, so the two cannot disagree about who may open the same bytes.
 */
export async function setDocumentVisibility(
  ctx: DeveloperContext & { canModerate: boolean },
  documentId: string,
  visibility: unknown
) {
  if (!ctx.canModerate) throw new ServiceError('Only an owner or admin can change who can see a document', 403)
  if (!isDocumentVisibility(visibility)) throw new ServiceError('Visibility must be team or managers')

  const doc = await prisma.salesDocument.findFirst({
    where: { id: documentId, workspaceId: ctx.workspaceId },
    select: { id: true, pdfPath: true },
  })
  if (!doc) throw new ServiceError('Document not found', 404)

  await prisma.$transaction([
    prisma.salesDocument.update({ where: { id: doc.id }, data: { visibility } }),
    ...(doc.pdfPath
      ? [prisma.leadFile.updateMany({ where: { workspaceId: ctx.workspaceId, filePath: doc.pdfPath }, data: { visibility } })]
      : []),
  ])
  return { id: doc.id, visibility }
}

// ─── Buyer side ──────────────────────────────────────────────────────────────

/** The documents a buyer can see in their purchase space: sent or accepted, never drafts or voided ones. */
export function listBuyerDocuments(lotId: string) {
  return prisma.salesDocument.findMany({
    where: { lotId, status: { in: ['sent', 'accepted'] } },
    orderBy: { createdAt: 'desc' },
    select: { id: true, kind: true, number: true, title: true, status: true, sentAt: true, acceptedAt: true, acceptedName: true },
  })
}

/**
 * The buyer accepts a document from their purchase space (already signed in with
 * the emailed code).
 *
 * Before recording anything, the stored PDF is fetched and hashed again and must
 * match the fingerprint taken when it was sent. That is what lets the acceptance
 * say "this exact file": if the stored object were ever replaced or corrupted, the
 * buyer is not shown as having agreed to something they never saw.
 *
 * The record is time, address and device as well as the typed name. It is evidence
 * of an electronic acceptance, not a qualified electronic signature, and the
 * accepted copy says only what it can show.
 */
export async function acceptDocument(
  lotId: string,
  documentId: string,
  input: { name: unknown; confirm: unknown },
  evidence: { ip: string | null; userAgent: string | null }
) {
  const name = typeof input.name === 'string' ? input.name.trim().replace(/\s+/g, ' ') : ''
  if (name.length < 3 || name.length > 120) throw new ServiceError('Please type your full name to accept', 400)
  if (input.confirm !== true) throw new ServiceError('Please confirm that you have read and accept the document', 400)

  const doc = await prisma.salesDocument.findFirst({
    where: { id: documentId, lotId },
    include: {
      lot: { select: { id: true, workspaceId: true, lotNumber: true, salesAgentId: true, buyerLeadId: true, workspace: { select: { ownerId: true } } } },
    },
  })
  if (!doc) throw new ServiceError('Document not found', 404)
  if (doc.status === 'accepted') throw new ServiceError('This document has already been accepted', 409)
  if (doc.status !== 'sent' || !doc.pdfPath || !doc.contentHash) throw new ServiceError('This document is not open for acceptance', 409)

  const stored = await downloadStored(doc.pdfPath)
  if (!stored || sha256(stored) !== doc.contentHash) {
    console.error('[sales-documents] stored file does not match its fingerprint for', doc.id)
    throw new ServiceError('We could not verify this document. Please contact your developer representative.', 409)
  }

  // Claimed with a conditional update, so two simultaneous accepts record one.
  const claimed = await prisma.salesDocument.updateMany({
    where: { id: doc.id, status: 'sent' },
    data: {
      status: 'accepted',
      acceptedAt: new Date(),
      acceptedName: name,
      acceptedIp: evidence.ip?.slice(0, 64) ?? null,
      acceptedUserAgent: evidence.userAgent?.slice(0, 300) ?? null,
      acceptedHash: doc.contentHash,
    },
  })
  if (claimed.count === 0) throw new ServiceError('This document has already been accepted', 409)

  // The acting user is the unit's agent, else the workspace owner: acceptance is
  // the buyer's act, but everything it sets off needs a team member to be attributed to.
  const actor = { workspaceId: doc.lot.workspaceId, userId: doc.lot.salesAgentId ?? doc.lot.workspace.ownerId }

  if (doc.kind === 'contract') {
    // Through the same path as a manual change, so the dates, the buyer's card and
    // the commission all follow without a second implementation of "contract signed".
    await updateLot(actor, doc.lot.id, { status: 'contract_signed' })
    try {
      await createTask(actor, {
        leadId: doc.leadId ?? doc.lot.buyerLeadId ?? undefined,
        type: 'contract',
        title: `Send the countersigned copy of ${doc.number}`,
        dueAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        assigneeId: doc.lot.salesAgentId ?? undefined,
      })
    } catch (error) {
      console.error('Could not create the countersign follow-up:', error)
    }
  }

  if (doc.leadId) {
    await CrmLogger.logActivity(
      actor.workspaceId,
      actor.userId,
      'sales_document_accepted',
      doc.leadId,
      `${KIND_LABEL[doc.kind as DocumentKind]} ${doc.number} accepted by ${name}`,
      { documentId: doc.id, number: doc.number, hash: doc.contentHash, ...(doc.visibility !== 'team' ? { visibility: doc.visibility } : {}) },
      doc.leadId
    )
  }

  void notify({
    recipients: Array.from(new Set([actor.userId, doc.lot.workspace.ownerId])),
    type: 'crm.document_accepted',
    workspaceId: actor.workspaceId,
    title: `${doc.number} accepted by ${name}`,
    body: `Unit ${doc.lot.lotNumber}`,
    href: `/crm?workspace=${actor.workspaceId}${doc.leadId ? `&lead=${doc.leadId}&tab=customer` : ''}`,
    dedupeKey: `sales.accepted:${doc.id}`,
  })

  return prisma.salesDocument.findUniqueOrThrow({
    where: { id: doc.id },
    select: { id: true, kind: true, number: true, title: true, status: true, sentAt: true, acceptedAt: true, acceptedName: true },
  })
}
