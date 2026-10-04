import { prisma } from '@/lib/prisma'
import { generatePublicToken } from '@/lib/documents/share'

/**
 * Unguessable public links for real-estate records, following the quote and
 * invoice pattern in src/lib/documents/share.ts: a random token rather than the
 * record id (ids leak through other endpoints and are enumerable), minted on
 * demand, and revoked only by rotating it.
 */

function appUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '')
}

/** Where a vendor accepts or declines an offer. Under /view: noindex, no login. */
export function publicOfferUrl(token: string): string {
  return `${appUrl()}/view/offer/${token}`
}

/** The vendor report for a mandate. */
export function publicMandateUrl(token: string): string {
  return `${appUrl()}/view/mandate/${token}`
}

/** The public listing page. Not under /view: a listing should be indexed. */
export function publicListingUrl(token: string): string {
  return `${appUrl()}/listings/${token}`
}

type TokenKind = 'offer' | 'mandate' | 'property'

const URL_FOR: Record<TokenKind, (token: string) => string> = {
  offer: publicOfferUrl,
  mandate: publicMandateUrl,
  property: publicListingUrl,
}

/**
 * Mint a record's token, or return the existing one. `rotate` issues a fresh
 * token, which is what revokes a link that has already been sent.
 */
export async function mintToken(
  kind: TokenKind,
  id: string,
  { rotate = false }: { rotate?: boolean } = {}
): Promise<{ token: string; url: string }> {
  const current =
    kind === 'offer'
      ? await prisma.offer.findUnique({ where: { id }, select: { publicToken: true } })
      : kind === 'mandate'
        ? await prisma.mandate.findUnique({ where: { id }, select: { publicToken: true } })
        : await prisma.property.findUnique({ where: { id }, select: { publicToken: true } })

  if (current?.publicToken && !rotate) {
    return { token: current.publicToken, url: URL_FOR[kind](current.publicToken) }
  }

  const token = generatePublicToken()
  const data = { publicToken: token, publicTokenCreatedAt: new Date() }

  if (kind === 'offer') await prisma.offer.update({ where: { id }, data })
  else if (kind === 'mandate') await prisma.mandate.update({ where: { id }, data })
  else await prisma.property.update({ where: { id }, data })

  return { token, url: URL_FOR[kind](token) }
}

/** A vendor responding to an offer may only accept or decline it; limited per link. */
export const OFFER_RESPONSE_RATE_LIMIT = {
  bucket: 'offer:respond',
  limit: 20,
  windowMs: 60 * 60 * 1000,
  windowLabel: 'hour',
} as const

/** Reading a public page: generous, but a leaked link must not be a free database hammer. */
export const OFFER_VIEW_RATE_LIMIT = {
  bucket: 'offer:view',
  limit: 120,
  windowMs: 60 * 60 * 1000,
  windowLabel: 'hour',
} as const

/** Reading a vendor report: generous, but a leaked link must not be a free database hammer. */
export const MANDATE_VIEW_RATE_LIMIT = {
  bucket: 'mandate:view',
  limit: 120,
  windowMs: 60 * 60 * 1000,
  windowLabel: 'hour',
} as const

/**
 * Public listing traffic is per link, and generous: a listing page loads many images,
 * and crawlers and portals fetch them. The limit exists so a leaked or abused link
 * cannot be a free way to hammer storage, not to meter ordinary visitors.
 */
export const LISTING_VIEW_RATE_LIMIT = { bucket: 'listing:view', limit: 1200, windowMs: 60 * 60 * 1000, windowLabel: 'hour' } as const
export const LISTING_MEDIA_RATE_LIMIT = { bucket: 'listing:media', limit: 6000, windowMs: 60 * 60 * 1000, windowLabel: 'hour' } as const
export const PORTAL_FEED_RATE_LIMIT = { bucket: 'portal:feed', limit: 60, windowMs: 60 * 60 * 1000, windowLabel: 'hour' } as const
export const PORTAL_ENQUIRY_RATE_LIMIT = { bucket: 'portal:enquiry', limit: 600, windowMs: 60 * 60 * 1000, windowLabel: 'hour' } as const
