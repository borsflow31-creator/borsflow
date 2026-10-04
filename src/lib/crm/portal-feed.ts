import { prisma } from '@/lib/prisma'
import { escapeHtml } from '@/lib/html'
import { generatePublicToken } from '@/lib/documents/share'
import { toPublicListing, type PublicListing } from '@/lib/crm/public-listing'

/**
 * Outbound listing feeds.
 *
 * Most demand arrives from portals, and a feed is how stock gets there: the portal
 * fetches a tokenised URL on a schedule and ingests whatever is live.
 *
 * Honest scope. Each portal publishes its own import specification and requires an
 * agency to be onboarded before it will read a feed at all. What is built here is the
 * hard, shared part -- selecting the right listings, withholding what must be withheld,
 * stable image URLs, a token that can be revoked -- plus a *profile* per portal that
 * renames the elements and fields to that portal's conventions. A profile is the
 * starting point for that onboarding, not a certified integration; the field maps in
 * PROFILES are where a portal's actual spec is applied once it is in hand.
 */

export const PORTALS = ['generic', 'seloger', 'idealista', 'rightmove', 'immoweb', 'zillow'] as const
export type Portal = (typeof PORTALS)[number]
export const FEED_FORMATS = ['xml', 'json'] as const
export type FeedFormat = (typeof FEED_FORMATS)[number]

/** The default for a feed that names no statuses: only what is actually for sale. */
export const DEFAULT_FEED_STATUSES = ['live']

type LogicalField =
  | 'id' | 'title' | 'description' | 'type' | 'transaction' | 'price' | 'currency' | 'city' | 'postalCode' | 'country'
  | 'address' | 'latitude' | 'longitude' | 'surface' | 'rooms' | 'bedrooms' | 'bathrooms' | 'energy' | 'photos' | 'url'

interface Profile {
  root: string
  item: string
  fields: Record<LogicalField, string>
}

const generic: Profile['fields'] = {
  id: 'reference', title: 'title', description: 'description', type: 'propertyType', transaction: 'transactionType',
  price: 'price', currency: 'currency', city: 'city', postalCode: 'postalCode', country: 'country', address: 'address',
  latitude: 'latitude', longitude: 'longitude', surface: 'surface', rooms: 'rooms', bedrooms: 'bedrooms',
  bathrooms: 'bathrooms', energy: 'energyRating', photos: 'photos', url: 'url',
}

const PROFILES: Record<Portal, Profile> = {
  generic: { root: 'listings', item: 'listing', fields: generic },
  seloger: {
    root: 'annonces', item: 'annonce',
    fields: { ...generic, id: 'reference', title: 'titre', description: 'description', type: 'type_bien', transaction: 'type_transaction', price: 'prix', currency: 'devise', city: 'ville', postalCode: 'code_postal', country: 'pays', address: 'adresse', surface: 'surface', rooms: 'pieces', bedrooms: 'chambres', bathrooms: 'salles_de_bain', energy: 'dpe', photos: 'photos', url: 'url' },
  },
  idealista: {
    root: 'properties', item: 'property',
    fields: { ...generic, id: 'propertyCode', title: 'propertyTitle', description: 'propertyDescription', type: 'propertyType', transaction: 'operation', price: 'price', city: 'municipality', postalCode: 'postalCode', address: 'address', surface: 'constructedArea', rooms: 'rooms', bedrooms: 'bedrooms', bathrooms: 'bathrooms', energy: 'energyCertificate', photos: 'images' },
  },
  rightmove: {
    root: 'properties', item: 'property',
    fields: { ...generic, id: 'agent_ref', title: 'summary', description: 'details', type: 'property_type', transaction: 'transaction_type', price: 'price', city: 'town', postalCode: 'postcode', address: 'address', bedrooms: 'bedrooms', bathrooms: 'bathrooms', photos: 'media' },
  },
  immoweb: {
    root: 'ads', item: 'ad',
    fields: { ...generic, id: 'external_id', title: 'title', description: 'description', type: 'property_type', transaction: 'transaction_type', price: 'price', city: 'locality', postalCode: 'postal_code', surface: 'living_area', bedrooms: 'bedroom_count', bathrooms: 'bathroom_count', energy: 'epc_label', photos: 'pictures' },
  },
  zillow: {
    root: 'Listings', item: 'Listing',
    fields: { ...generic, id: 'ListingID', title: 'Title', description: 'Description', type: 'PropertyType', transaction: 'ListingType', price: 'ListPrice', currency: 'Currency', city: 'City', postalCode: 'PostalCode', country: 'Country', address: 'StreetAddress', latitude: 'Latitude', longitude: 'Longitude', surface: 'LivingArea', rooms: 'Rooms', bedrooms: 'Bedrooms', bathrooms: 'Bathrooms', photos: 'Photos', url: 'ListingURL' },
  },
}

export function isPortal(value: unknown): value is Portal {
  return typeof value === 'string' && (PORTALS as readonly string[]).includes(value)
}

function readList(raw: string | null): string[] {
  try {
    const v = JSON.parse(raw ?? '[]')
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []
  } catch {
    return []
  }
}

interface FeedConfig {
  workspaceId: string
  portal: string
  filterStatuses: string | null
  filterPropertyTypes: string | null
  filterCities: string | null
  includeUnpublished: boolean
}

/**
 * The listings a feed carries: the statuses it asks for (live by default), only those
 * the agency has published unless the feed says otherwise, and the type and city
 * filters. Properties without a public token are given one, because the image URLs a
 * portal stores are addressed by it.
 */
export async function loadFeedListings(feed: FeedConfig): Promise<PublicListing[]> {
  const statuses = readList(feed.filterStatuses)
  const types = readList(feed.filterPropertyTypes)
  const cities = readList(feed.filterCities)

  const rows = await prisma.property.findMany({
    where: {
      workspaceId: feed.workspaceId,
      status: { in: statuses.length ? statuses : DEFAULT_FEED_STATUSES },
      ...(feed.includeUnpublished ? {} : { isPublished: true }),
      ...(types.length ? { propertyType: { in: types } } : {}),
      ...(cities.length ? { OR: cities.map(c => ({ city: { equals: c, mode: 'insensitive' as const } })) } : {}),
    },
    include: {
      workspace: { select: { name: true, currency: true } },
      media: { orderBy: [{ position: 'asc' }, { createdAt: 'asc' }] },
    },
    orderBy: { listedAt: 'desc' },
    take: 5000,
  })

  const listings: PublicListing[] = []
  for (const row of rows) {
    let token = row.publicToken
    if (!token) {
      token = generatePublicToken()
      await prisma.property.update({ where: { id: row.id }, data: { publicToken: token, publicTokenCreatedAt: new Date() } })
    }
    listings.push(toPublicListing({ ...row, publicToken: token }))
  }
  return listings
}

function appUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '')
}

/** One listing as an object keyed by the portal's field names. */
function mapListing(listing: PublicListing, profile: Profile): Record<string, unknown> {
  const f = profile.fields
  const photos = listing.media.filter(m => m.kind === 'photo').map(m => m.url)
  return {
    [f.id]: listing.reference,
    [f.title]: listing.title,
    [f.description]: listing.description,
    [f.type]: listing.propertyType,
    [f.transaction]: listing.transactionType,
    [f.price]: listing.price,
    [f.currency]: listing.currency,
    [f.city]: listing.city,
    [f.postalCode]: listing.postalCode,
    [f.country]: listing.countryCode,
    // Absent unless the agency chose to show the street, exactly as on the public page.
    [f.address]: listing.addressLine,
    [f.latitude]: listing.latitude,
    [f.longitude]: listing.longitude,
    [f.surface]: listing.surfaceArea,
    [f.rooms]: listing.rooms,
    [f.bedrooms]: listing.bedrooms,
    [f.bathrooms]: listing.bathrooms,
    [f.energy]: listing.energyRating,
    [f.photos]: photos,
    [f.url]: `${appUrl()}/listings/${listing.token}`,
  }
}

function toXml(value: unknown, tag: string, indent: string): string {
  if (value === null || value === undefined || value === '') return ''
  if (Array.isArray(value)) {
    if (value.length === 0) return ''
    const item = tag.endsWith('s') ? tag.slice(0, -1) : 'item'
    return `${indent}<${tag}>\n${value.map(v => `${indent}  <${item}>${escapeHtml(String(v))}</${item}>`).join('\n')}\n${indent}</${tag}>\n`
  }
  return `${indent}<${tag}>${escapeHtml(String(value))}</${tag}>\n`
}

/** Render a feed: the body, its content type and how many listings it carries. */
export async function renderPortalFeed(feed: FeedConfig & { format: string }): Promise<{ body: string; contentType: string; count: number }> {
  const profile = PROFILES[isPortal(feed.portal) ? feed.portal : 'generic']
  const listings = await loadFeedListings(feed)
  const items = listings.map(l => mapListing(l, profile))

  if (feed.format === 'json') {
    return {
      body: JSON.stringify({ [profile.root]: items.map(i => Object.fromEntries(Object.entries(i).filter(([, v]) => v !== null && v !== undefined && !(Array.isArray(v) && v.length === 0)))) }, null, 2),
      contentType: 'application/json; charset=utf-8',
      count: items.length,
    }
  }

  const body = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<${profile.root}>`,
    ...items.map(item => `  <${profile.item}>\n${Object.entries(item).map(([tag, v]) => toXml(v, tag, '    ')).join('')}  </${profile.item}>`),
    `</${profile.root}>`,
    '',
  ].join('\n')
  return { body, contentType: 'application/xml; charset=utf-8', count: items.length }
}
