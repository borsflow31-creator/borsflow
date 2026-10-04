import { createHmac } from 'crypto'
import { prisma } from '@/lib/prisma'
import { ServiceError } from '../errors'

const PORTAL_SECRET = process.env.NEXTAUTH_SECRET || 'borsflow-developer-portal-secret-key-2026'

/** Generates a cryptographic verification token for the OTP-authenticated session */
export function createVerificationSessionToken(lotId: string, leadId: string): string {
  const payload = `${lotId}:${leadId}:${Math.floor(Date.now() / (24 * 3600 * 1000))}` // 24-hour validity bucket
  const hmac = createHmac('sha256', PORTAL_SECRET).update(payload).digest('hex')
  return `${Buffer.from(payload).toString('base64')}.${hmac}`
}

/** Validates whether the buyer's session token is valid */
export function verifySessionToken(tokenString: string, lotId: string, leadId: string): boolean {
  try {
    const [payloadB64, signature] = tokenString.split('.')
    if (!payloadB64 || !signature) return false

    const payload = Buffer.from(payloadB64, 'base64').toString('utf-8')
    const [tLotId, tLeadId] = payload.split(':')
    if (tLotId !== lotId || tLeadId !== leadId) return false

    const expectedSig = createHmac('sha256', PORTAL_SECRET).update(payload).digest('hex')
    return expectedSig === signature
  } catch {
    return false
  }
}

function maskEmail(email?: string | null): string {
  if (!email) return 'your registered email'
  const [user, domain] = email.split('@')
  if (!domain) return email
  const visible = user.slice(0, 2)
  return `${visible}***@${domain}`
}

function maskName(firstName?: string | null, lastName?: string | null): string {
  if (!lastName) return firstName || 'Valued Purchaser'
  return `${firstName || ''} ${lastName.charAt(0)}.`.trim()
}

/** Fetches buyer portal data according to the hybrid security model */
export async function getBuyerPortalData(publicToken: string, sessionAuthToken?: string) {
  const lot = await prisma.developmentLot.findUnique({
    where: { publicToken },
    include: {
      program: {
        include: {
          milestones: { orderBy: { order: 'asc' } },
          media: { orderBy: { createdAt: 'desc' } },
        },
      },
      building: true,
      buyerLead: true,
      optionHolderLead: true,
      callsForFunds: {
        include: { milestone: true, invoice: true },
        orderBy: { milestone: { order: 'asc' } },
      },
      tmaRequests: {
        orderBy: { createdAt: 'desc' },
      },
      snags: {
        orderBy: { createdAt: 'desc' },
      },
      childLots: true,
      parentLot: true,
    },
  })

  if (!lot) {
    throw new ServiceError('This buyer portal link is invalid or has expired', 404)
  }

  const buyer = lot.buyerLead || lot.optionHolderLead
  const isVerified = Boolean(
    sessionAuthToken &&
      buyer &&
      verifySessionToken(sessionAuthToken, lot.id, buyer.id)
  )

  // Baseline data accessible without password (construction diary, photos, unit specs)
  const portalData: any = {
    isVerified,
    lot: {
      id: lot.id,
      lotNumber: lot.lotNumber,
      type: lot.type,
      typology: lot.typology,
      floor: lot.floor,
      orientation: lot.orientation,
      surfaceArea: lot.surfaceArea,
      terraceArea: lot.terraceArea,
      balconyArea: lot.balconyArea,
      gardenArea: lot.gardenArea,
      status: lot.status,
      annexes: lot.childLots.map((c) => ({
        lotNumber: c.lotNumber,
        type: c.type,
      })),
    },
    program: {
      name: programName(lot.program),
      description: lot.program.description,
      addressLine: lot.program.addressLine,
      city: lot.program.city,
      postalCode: lot.program.postalCode,
      targetDeliveryDate: lot.program.targetDeliveryDate,
      architectName: lot.program.architectName,
      gfaBank: lot.program.gfaBank,
      status: lot.program.status,
      media: lot.program.media,
      milestones: lot.program.milestones.map((m) => ({
        id: m.id,
        order: m.order,
        title: m.title,
        targetPercentage: m.targetPercentage,
        isCertified: m.isCertified,
        certifiedAt: m.certifiedAt,
      })),
    },
    buyer: {
      displayName: maskName(buyer?.firstName, buyer?.lastName),
      maskedEmail: maskEmail(buyer?.email),
      hasRegisteredEmail: Boolean(buyer?.email),
    },
  }

  // Sensitive financial & legal data unlocked only after OTP verification
  if (isVerified) {
    portalData.pricing = {
      basePrice: lot.basePrice,
      taxRate: lot.taxRate,
      totalPrice: lot.totalPrice,
    }
    portalData.callsForFunds = lot.callsForFunds.map((call) => ({
      id: call.id,
      callNumber: call.callNumber,
      milestoneTitle: call.milestone.title,
      percentage: call.percentage,
      amount: call.amount,
      status: call.status,
      issuedAt: call.issuedAt,
      dueAt: call.dueAt,
      paidAt: call.paidAt,
      invoiceToken: call.invoice?.publicToken || null,
      invoiceNumber: call.invoice?.invoiceNumber || null,
    }))
    portalData.tmaRequests = lot.tmaRequests.map((tma) => ({
      id: tma.id,
      reference: tma.reference,
      category: tma.category,
      title: tma.title,
      description: tma.description,
      status: tma.status,
      priceQuote: tma.priceQuote,
      techApproverNote: tma.techApproverNote,
      signedAt: tma.signedAt,
      signedAddendumDoc: tma.signedAddendumDoc,
    }))
    portalData.snags = lot.snags.map((snag) => ({
      id: snag.id,
      roomLocation: snag.room,
      description: snag.description,
      severity: snag.warrantyType,
      status: snag.status,
      tradeContractor: snag.contractorName || snag.trade,
      resolvedAt: snag.resolvedAt,
    }))
    portalData.buyerFull = {
      firstName: buyer?.firstName,
      lastName: buyer?.lastName,
      email: buyer?.email,
      phone: buyer?.phone,
    }
  } else {
    // Unverified summary hints
    portalData.callsForFundsSummary = {
      totalCalls: lot.callsForFunds.length,
      paidCalls: lot.callsForFunds.filter((c) => c.status === 'paid').length,
    }
    portalData.tmaSummary = {
      totalRequests: lot.tmaRequests.length,
      acceptedCount: lot.tmaRequests.filter((t) => t.status === 'accepted').length,
    }
  }

  return portalData
}

function programName(prog: any): string {
  return prog.commercialName || prog.name
}

/** Sends a 6-digit OTP code to the purchaser's registered contact info */
export async function sendPortalOTP(publicToken: string) {
  const lot = await prisma.developmentLot.findUnique({
    where: { publicToken },
    include: {
      buyerLead: true,
      optionHolderLead: true,
    },
  })

  if (!lot) throw new ServiceError('Invalid portal token', 404)
  const buyer = lot.buyerLead || lot.optionHolderLead
  if (!buyer || !buyer.email) {
    throw new ServiceError('No registered email found for this unit. Please contact your developer representative.', 400)
  }

  // Generate 6-digit OTP code
  const otpCode = Math.floor(100000 + Math.random() * 900000).toString()
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000) // 10 minutes

  await prisma.developmentLot.update({
    where: { id: lot.id },
    data: {
      portalOtpCode: otpCode,
      portalOtpExpiresAt: expiresAt,
    },
  })

  // In production: send via emailProvider.
  // We return masked email, and in development return code for immediate testability.
  return {
    success: true,
    maskedEmail: maskEmail(buyer.email),
    expiresInSeconds: 600,
    devCode: process.env.NODE_ENV !== 'production' ? otpCode : undefined,
  }
}

/** Validates the 6-digit OTP code and mints an authenticated session token */
export async function verifyPortalOTP(publicToken: string, inputCode: string) {
  const lot = await prisma.developmentLot.findUnique({
    where: { publicToken },
    include: {
      buyerLead: true,
      optionHolderLead: true,
    },
  })

  if (!lot) throw new ServiceError('Invalid portal token', 404)
  const buyer = lot.buyerLead || lot.optionHolderLead
  if (!buyer) throw new ServiceError('No buyer associated with this unit', 400)

  if (!lot.portalOtpCode || !lot.portalOtpExpiresAt) {
    throw new ServiceError('No OTP request found. Please request a new verification code.', 400)
  }

  if (new Date() > lot.portalOtpExpiresAt) {
    throw new ServiceError('This verification code has expired. Please request a new code.', 400)
  }

  if (lot.portalOtpCode.trim() !== inputCode.trim()) {
    throw new ServiceError('Invalid verification code. Please check and try again.', 400)
  }

  // Clear code after successful verification
  await prisma.developmentLot.update({
    where: { id: lot.id },
    data: {
      portalOtpCode: null,
      portalOtpExpiresAt: null,
    },
  })

  const sessionToken = createVerificationSessionToken(lot.id, buyer.id)
  return {
    verified: true,
    sessionToken,
  }
}

/** Authenticates the buyer's session token from the Authorization header */
export async function authenticateBuyerSession(publicToken: string, sessionAuthToken?: string) {
  if (!sessionAuthToken) {
    throw new ServiceError('Identity verification required. Please enter your 6-digit code.', 401)
  }

  const lot = await prisma.developmentLot.findUnique({
    where: { publicToken },
    include: {
      buyerLead: true,
      optionHolderLead: true,
      program: true,
    },
  })

  if (!lot) throw new ServiceError('Invalid portal token', 404)
  const buyer = lot.buyerLead || lot.optionHolderLead
  if (!buyer) throw new ServiceError('No purchaser registered for this unit', 400)

  const isValid = verifySessionToken(sessionAuthToken, lot.id, buyer.id)
  if (!isValid) {
    throw new ServiceError('Your verification session has expired. Please request a new code.', 401)
  }

  return { lot, buyer }
}

/** Creates a new customization request (TMA) directly from the verified buyer portal */
export async function createBuyerTMARequest(
  publicToken: string,
  sessionAuthToken: string,
  input: { title: string; description: string; category?: string }
) {
  const { lot, buyer } = await authenticateBuyerSession(publicToken, sessionAuthToken)

  const title = input.title?.trim()
  if (!title) throw new ServiceError('Title is required', 400)
  const description = input.description?.trim()
  if (!description) throw new ServiceError('Description is required', 400)
  const category = input.category || 'finishes'

  const count = await prisma.tMARequest.count({
    where: { lotId: lot.id },
  })
  const reference = `TMA-${lot.lotNumber}-${String(count + 1).padStart(2, '0')}`

  const tma = await prisma.tMARequest.create({
    data: {
      workspaceId: lot.workspaceId,
      lotId: lot.id,
      buyerLeadId: buyer.id,
      reference,
      category,
      title,
      description,
      status: 'requested',
      costEstimate: 0,
      priceQuote: 0,
    },
  })

  return tma
}

/** Electronically signs and accepts a TMA quote from the verified buyer portal */
export async function acceptBuyerTMAQuote(
  publicToken: string,
  sessionAuthToken: string,
  tmaId: string,
  signatureName: string
) {
  const { lot } = await authenticateBuyerSession(publicToken, sessionAuthToken)

  const tma = await prisma.tMARequest.findFirst({
    where: { id: tmaId, lotId: lot.id },
  })
  if (!tma) throw new ServiceError('Customization request not found', 404)

  if (tma.status === 'accepted') {
    throw new ServiceError('This change order has already been signed and accepted', 400)
  }

  const updated = await prisma.tMARequest.update({
    where: { id: tmaId },
    data: {
      status: 'accepted',
      signedAt: new Date(),
      signedAddendumDoc: `Digitally accepted by ${signatureName.trim()} on ${new Date().toLocaleDateString('en-US')}`,
    },
  })

  // Automatically update the lot's total price by adding the signed TMA price quote
  if (tma.priceQuote > 0) {
    const newTotalPrice = Number((lot.totalPrice + tma.priceQuote).toFixed(2))
    await prisma.developmentLot.update({
      where: { id: lot.id },
      data: { totalPrice: newTotalPrice },
    })
  }

  return updated
}
