import { createHmac, randomInt, timingSafeEqual } from 'crypto'
import { prisma } from '@/lib/prisma'
import { consumeRateLimits, type RateLimitRule } from '@/lib/api/rate-limit'
import { emailParagraph, renderEmail, sendTransactionalEmail } from '@/lib/email'
import { escapeHtml } from '@/lib/html'
import { ServiceError } from '../errors'
import { DEFAULT_CURRENCY } from '@/lib/currencies'

/**
 * The key that signs portal sessions and one-time codes.
 *
 * There is deliberately no fallback. A hard-coded default would be the same key on
 * every deployment that forgot to set one, and anyone who had read this file could
 * mint a session for any unit. A missing secret is a misconfigured server, and the
 * portal says so instead of quietly running unprotected.
 */
function portalSecret(): string {
  const secret = process.env.NEXTAUTH_SECRET
  if (!secret) throw new ServiceError('The buyer portal is not configured', 503)
  return secret
}

/** Wrong guesses allowed against one code before it is burned. */
export const OTP_MAX_ATTEMPTS = 5

const OTP_SEND_PER_LOT: RateLimitRule = { bucket: 'portal:otp-send', limit: 5, windowMs: 60 * 60 * 1000, windowLabel: 'hour' }
const OTP_SEND_PER_IP: RateLimitRule = { bucket: 'portal:otp-send', limit: 20, windowMs: 60 * 60 * 1000, windowLabel: 'hour' }
const OTP_VERIFY_PER_LOT: RateLimitRule = { bucket: 'portal:otp-verify', limit: 15, windowMs: 15 * 60 * 1000, windowLabel: '15 minutes' }
const OTP_VERIFY_PER_IP: RateLimitRule = { bucket: 'portal:otp-verify', limit: 30, windowMs: 15 * 60 * 1000, windowLabel: '15 minutes' }

/**
 * A one-time code is stored as a keyed hash, never as the digits. The database then
 * holds nothing that logs in anyone, and the key is the server's, so a leaked row
 * cannot be brute-forced offline without it. Bound to the unit so a hash from one
 * unit means nothing on another.
 */
export function hashOtp(lotId: string, code: string): string {
  return createHmac('sha256', portalSecret()).update(`otp:${lotId}:${code}`).digest('hex')
}

/** Constant-time comparison of two hex digests of equal length. */
export function otpMatches(expectedHash: string, lotId: string, input: string): boolean {
  const actual = Buffer.from(hashOtp(lotId, input.trim()), 'hex')
  const expected = Buffer.from(expectedHash, 'hex')
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}

/** Generates a cryptographic verification token for the OTP-authenticated session */
export function createVerificationSessionToken(lotId: string, leadId: string): string {
  const payload = `${lotId}:${leadId}:${Math.floor(Date.now() / (24 * 3600 * 1000))}` // 24-hour validity bucket
  const hmac = createHmac('sha256', portalSecret()).update(payload).digest('hex')
  return `${Buffer.from(payload).toString('base64')}.${hmac}`
}

/**
 * Validates whether the buyer's session token is valid.
 *
 * The token's third field is the day it was minted, and it is signed along with
 * the rest, but it used to be ignored on the way back in, so a session never
 * expired. It is now required to be today's or yesterday's, which bounds a session
 * to between 24 and 48 hours depending on when in the day it was issued.
 */
export function verifySessionToken(tokenString: string, lotId: string, leadId: string): boolean {
  try {
    const [payloadB64, signature] = tokenString.split('.')
    if (!payloadB64 || !signature) return false

    const payload = Buffer.from(payloadB64, 'base64').toString('utf-8')
    const [tLotId, tLeadId, tDay] = payload.split(':')
    if (tLotId !== lotId || tLeadId !== leadId) return false

    const today = Math.floor(Date.now() / (24 * 3600 * 1000))
    const minted = Number(tDay)
    if (!Number.isInteger(minted) || today - minted < 0 || today - minted > 1) return false

    const expected = Buffer.from(createHmac('sha256', portalSecret()).update(payload).digest('hex'))
    const actual = Buffer.from(signature)
    return expected.length === actual.length && timingSafeEqual(expected, actual)
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
  // Amounts on the portal are in the developer's own currency.
  const workspace = await prisma.workspace.findUnique({ where: { id: lot.workspaceId }, select: { currency: true } })

  const portalData: any = {
    isVerified,
    currency: workspace?.currency || DEFAULT_CURRENCY,
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
      countryCode: lot.program.countryCode,
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

/** Sends a 6-digit one-time code to the purchaser's registered email. */
export async function sendPortalOTP(publicToken: string, ip = 'unknown') {
  const lot = await prisma.developmentLot.findUnique({
    where: { publicToken },
    include: {
      buyerLead: true,
      optionHolderLead: true,
      workspace: { select: { name: true } },
      program: { select: { name: true } },
    },
  })

  if (!lot) throw new ServiceError('Invalid portal token', 404)

  // Before anything is sent: every code is an email to a third party, so an
  // unthrottled endpoint is a way to flood a buyer's inbox with the developer's name on it.
  const limit = await consumeRateLimits(
    [
      { subject: `lot:${lot.id}`, rule: OTP_SEND_PER_LOT },
      { subject: `ip:${ip}`, rule: OTP_SEND_PER_IP },
    ],
    1
  )
  if (!limit.allowed) {
    throw new ServiceError('Too many verification codes requested. Please try again later.', 429)
  }

  const buyer = lot.buyerLead || lot.optionHolderLead
  if (!buyer || !buyer.email) {
    throw new ServiceError('No registered email found for this unit. Please contact your developer representative.', 400)
  }

  // randomInt draws from the OS CSPRNG; Math.random is predictable from its own output.
  const otpCode = String(randomInt(100000, 1000000))
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000) // 10 minutes

  await prisma.developmentLot.update({
    where: { id: lot.id },
    data: {
      portalOtpCode: hashOtp(lot.id, otpCode),
      portalOtpExpiresAt: expiresAt,
      portalOtpAttempts: 0,
    },
  })

  const developer = escapeHtml(lot.workspace.name)
  try {
    await sendTransactionalEmail({
      to: buyer.email,
      subject: `Your verification code: ${otpCode}`,
      senderName: lot.workspace.name,
      html: renderEmail({
        title: 'Your verification code',
        preheader: `Your code is ${otpCode}. It expires in 10 minutes.`,
        heading: 'Your verification code',
        body:
          emailParagraph(`Use this code to open your purchase space for <strong>${escapeHtml(lot.program.name)}</strong>, unit <strong>${escapeHtml(lot.lotNumber)}</strong>:`) +
          `<p style="margin:0 0 12px;font-size:28px;letter-spacing:8px;font-weight:700;">${otpCode}</p>` +
          emailParagraph('It expires in 10 minutes and works once.'),
        note: 'If you did not ask for this code, you can ignore this email. Nobody can sign in without it.',
        footer: `Sent on behalf of ${developer} because a code was requested for your purchase.`,
      }),
      text: `Your verification code is ${otpCode}. It expires in 10 minutes.`,
    })
  } catch (error) {
    console.error('Failed to send portal verification code:', error)
    // The code is useless if it never arrived: do not leave a live one behind.
    await prisma.developmentLot.update({
      where: { id: lot.id },
      data: { portalOtpCode: null, portalOtpExpiresAt: null },
    })
    throw new ServiceError('We could not send your verification code. Please try again shortly.', 503)
  }

  return {
    success: true,
    maskedEmail: maskEmail(buyer.email),
    expiresInSeconds: 600,
    // Only ever outside production, so local development works without a mail server.
    devCode: process.env.NODE_ENV !== 'production' ? otpCode : undefined,
  }
}

/** Validates the one-time code and mints an authenticated session token. */
export async function verifyPortalOTP(publicToken: string, inputCode: string, ip = 'unknown') {
  const lot = await prisma.developmentLot.findUnique({
    where: { publicToken },
    include: {
      buyerLead: true,
      optionHolderLead: true,
    },
  })

  if (!lot) throw new ServiceError('Invalid portal token', 404)

  const limit = await consumeRateLimits(
    [
      { subject: `lot:${lot.id}`, rule: OTP_VERIFY_PER_LOT },
      { subject: `ip:${ip}`, rule: OTP_VERIFY_PER_IP },
    ],
    1
  )
  if (!limit.allowed) {
    throw new ServiceError('Too many attempts. Please wait a few minutes and try again.', 429)
  }

  const buyer = lot.buyerLead || lot.optionHolderLead
  if (!buyer) throw new ServiceError('No buyer associated with this unit', 400)

  if (!lot.portalOtpCode || !lot.portalOtpExpiresAt) {
    throw new ServiceError('No OTP request found. Please request a new verification code.', 400)
  }

  if (new Date() > lot.portalOtpExpiresAt) {
    throw new ServiceError('This verification code has expired. Please request a new code.', 400)
  }

  if (lot.portalOtpAttempts >= OTP_MAX_ATTEMPTS) {
    throw new ServiceError('Too many wrong codes. Please request a new verification code.', 400)
  }

  if (!otpMatches(lot.portalOtpCode, lot.id, inputCode)) {
    // Counted atomically, so concurrent guesses cannot each read the same count
    // and all slip under the limit. At the limit the code is burned.
    const updated = await prisma.developmentLot.update({
      where: { id: lot.id },
      data: { portalOtpAttempts: { increment: 1 } },
      select: { portalOtpAttempts: true },
    })
    if (updated.portalOtpAttempts >= OTP_MAX_ATTEMPTS) {
      await prisma.developmentLot.update({
        where: { id: lot.id },
        data: { portalOtpCode: null, portalOtpExpiresAt: null },
      })
      throw new ServiceError('Too many wrong codes. Please request a new verification code.', 400)
    }
    throw new ServiceError('Invalid verification code. Please check and try again.', 400)
  }

  // Clear code after successful verification
  await prisma.developmentLot.update({
    where: { id: lot.id },
    data: { portalOtpCode: null, portalOtpExpiresAt: null, portalOtpAttempts: 0 },
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
