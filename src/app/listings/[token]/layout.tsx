import type { Metadata } from 'next'
import { JsonLd } from '@/components/seo/JsonLd'
import { loadPublicListing } from '@/lib/crm/public-listing'
import { siteUrl } from '@/lib/seo/site'

/**
 * A public listing is the one tokenised page that should be indexed: finding the home
 * is how a buyer arrives, which is the opposite of a quote or an offer. (Those live
 * under /view, which is noindex.) So this layout does the SEO work the page cannot:
 * the title, description, social image and the schema.org graph are generated on the
 * server, from the same allow-listed data the page shows, so a crawler gets them in
 * the HTML without executing any JavaScript.
 *
 * An unpublished, sold or withdrawn listing resolves to nothing, and is marked
 * noindex so a stale link stops advertising a home that is no longer for sale.
 */

const SCHEMA_TYPE: Record<string, string> = {
  apartment: 'Apartment', house: 'House', land: 'Residence', commercial: 'Residence', parking: 'Residence',
  building: 'Residence', other: 'Residence',
}

export async function generateMetadata({ params }: { params: { token: string } }): Promise<Metadata> {
  const listing = await loadPublicListing(params.token)
  if (!listing) return { title: 'Listing no longer available', robots: { index: false, follow: false } }

  const cover = listing.media.find(m => m.isCover && m.kind === 'photo') ?? listing.media.find(m => m.kind === 'photo')
  const description = (listing.description ?? `${listing.propertyType} in ${listing.city}`).replace(/\s+/g, ' ').slice(0, 160)
  const url = `${siteUrl()}/listings/${listing.token}`

  return {
    title: `${listing.title} — ${listing.city}`,
    description,
    alternates: { canonical: url },
    openGraph: { title: listing.title, description, url, type: 'website', ...(cover ? { images: [cover.url] } : {}) },
  }
}

export default async function ListingLayout({ children, params }: { children: React.ReactNode; params: { token: string } }) {
  const listing = await loadPublicListing(params.token)

  return (
    <>
      {listing && (
        <JsonLd
          data={{
            '@context': 'https://schema.org',
            '@type': 'RealEstateListing',
            name: listing.title,
            url: `${siteUrl()}/listings/${listing.token}`,
            ...(listing.listedAt ? { datePosted: listing.listedAt } : {}),
            description: listing.description ?? undefined,
            image: listing.media.filter(m => m.kind === 'photo').map(m => m.url),
            offers: { '@type': 'Offer', price: listing.price, priceCurrency: listing.currency },
            about: {
              '@type': SCHEMA_TYPE[listing.propertyType] ?? 'Residence',
              address: {
                '@type': 'PostalAddress',
                addressLocality: listing.city,
                ...(listing.postalCode ? { postalCode: listing.postalCode } : {}),
                ...(listing.countryCode ? { addressCountry: listing.countryCode } : {}),
                // The street only when the agency chose to show it.
                ...(listing.addressLine ? { streetAddress: listing.addressLine } : {}),
              },
              ...(listing.rooms != null ? { numberOfRooms: listing.rooms } : {}),
              ...(listing.bedrooms != null ? { numberOfBedrooms: listing.bedrooms } : {}),
              ...(listing.surfaceArea != null ? { floorSize: { '@type': 'QuantitativeValue', value: listing.surfaceArea, unitCode: 'MTK' } } : {}),
              ...(listing.buildYear != null ? { yearBuilt: listing.buildYear } : {}),
            },
          }}
        />
      )}
      {children}
    </>
  )
}
