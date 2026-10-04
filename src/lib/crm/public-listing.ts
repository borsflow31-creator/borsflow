import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { daysOnMarket } from '@/lib/crm/lifecycle'

/**
 * What the public may see of a listing, on the listing page and in portal feeds.
 *
 * An explicit allow-list, built field by field: the authenticated property shape
 * carries the vendor, the listing agent, internal custom fields and the exact
 * location of a home whose owner asked for it to be private, and reusing it here
 * would hand every one of those to anyone holding the link. Withholding is the
 * default; a field appears here because someone decided it should.
 *
 * Images are never URLs into the storage bucket. Each is a link to our own proxy
 * route, which signs a fresh short-lived URL when it is fetched. The bucket stays
 * private (it also holds vendor paperwork), and a portal that stores the link keeps
 * a link that works, instead of a signed URL that rots in minutes.
 */

export interface PublicListing {
  token: string
  reference: string
  title: string
  description: string | null
  propertyType: string
  transactionType: string
  status: string
  price: number
  currency: string
  city: string
  district: string | null
  postalCode: string | null
  countryCode: string | null
  /** The street, only when the agency chose to show it. */
  addressLine: string | null
  /** Exact when the address is public; otherwise rounded to about a kilometre. */
  latitude: number | null
  longitude: number | null
  surfaceArea: number | null
  landArea: number | null
  rooms: number | null
  bedrooms: number | null
  bathrooms: number | null
  floor: number | null
  buildYear: number | null
  energyRating: string | null
  amenities: string[]
  daysOnMarket: number | null
  listedAt: string | null
  agency: string
  media: { id: string; kind: string; url: string; caption: string | null; isCover: boolean }[]
}

export function appUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '')
}

/** The proxy URL for one media item of a public listing. */
export function publicMediaUrl(token: string, mediaId: string): string {
  return `${appUrl()}/api/public/properties/${token}/media/${mediaId}`
}

const AMENITIES: [string, string][] = [
  ['hasElevator', 'elevator'], ['hasParking', 'parking'], ['hasBalcony', 'balcony'], ['hasTerrace', 'terrace'],
  ['hasGarden', 'garden'], ['hasPool', 'pool'], ['furnished', 'furnished'],
]

const round2 = (n: number | null) => (n === null ? null : Math.round(n * 100) / 100)

const listingInclude = {
  workspace: { select: { name: true, currency: true } },
  media: { orderBy: [{ position: 'asc' }, { createdAt: 'asc' }] },
} satisfies Prisma.PropertyInclude

type ListingRow = NonNullable<Awaited<ReturnType<typeof findRow>>>

async function findRow(where: { publicToken: string } | { id: string }) {
  // A by-id lookup still requires a token (toPublicListing needs one); a by-token lookup
  // must filter on the token itself -- spreading both would let the `not null` clause
  // overwrite it and return whichever tokened property came first.
  const filter: Prisma.PropertyWhereInput = 'id' in where ? { id: where.id, publicToken: { not: null } } : { publicToken: where.publicToken }
  return prisma.property.findFirst({ where: filter, include: listingInclude })
}

export function toPublicListing(p: ListingRow): PublicListing {
  const token = p.publicToken!
  return {
    token,
    reference: p.reference,
    title: p.title,
    description: p.description,
    propertyType: p.propertyType,
    transactionType: p.transactionType,
    status: p.status,
    price: p.price,
    currency: p.currency || p.workspace.currency,
    city: p.city,
    district: p.district,
    postalCode: p.postalCode,
    countryCode: p.countryCode,
    addressLine: p.isAddressPublic ? p.addressLine : null,
    latitude: p.isAddressPublic ? p.latitude : round2(p.latitude),
    longitude: p.isAddressPublic ? p.longitude : round2(p.longitude),
    surfaceArea: p.surfaceArea,
    landArea: p.landArea,
    rooms: p.rooms,
    bedrooms: p.bedrooms,
    bathrooms: p.bathrooms,
    floor: p.floor,
    buildYear: p.buildYear,
    energyRating: p.energyRating,
    amenities: AMENITIES.filter(([column]) => (p as unknown as Record<string, unknown>)[column] === true).map(([, name]) => name),
    daysOnMarket: daysOnMarket(p.listedAt),
    listedAt: p.listedAt?.toISOString() ?? null,
    agency: p.workspace.name,
    media: p.media
      .filter(m => m.filePath || m.externalUrl)
      .map(m => ({
        id: m.id,
        kind: m.kind,
        // A file goes through the proxy; a video or tour is already a public link.
        url: m.filePath ? publicMediaUrl(token, m.id) : m.externalUrl!,
        caption: m.caption,
        isCover: m.isCover,
      })),
  }
}

/**
 * A property's public listing by token, or null. A listing is only public when the
 * agency has published it and it is on the market: a draft, a sold or a withdrawn
 * property returns null, so an old link stops working the moment the listing ends
 * rather than advertising something no longer for sale.
 */
export async function loadPublicListing(token: string): Promise<PublicListing | null> {
  const row = await findRow({ publicToken: token })
  if (!row || !row.isPublished || !['live', 'under_offer'].includes(row.status)) return null
  return toPublicListing(row)
}

/** The media item of a public listing, for the image proxy; null if it is not public. */
export async function findPublicMedia(token: string, mediaId: string) {
  const property = await prisma.property.findFirst({
    where: { publicToken: token, isPublished: true, status: { in: ['live', 'under_offer'] } },
    select: { id: true },
  })
  if (!property) return null
  return prisma.propertyMedia.findFirst({
    where: { id: mediaId, propertyId: property.id, filePath: { not: null } },
    select: { filePath: true, fileType: true },
  })
}
