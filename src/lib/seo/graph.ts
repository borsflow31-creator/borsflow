/**
 * The JSON-LD the marketing pages embed, in whichever language the page is
 * being served in.
 *
 * Every value is derived from copy that is already rendered: the FAQ entries,
 * the journey steps and the headings all read the same catalog the components
 * read, and the prices read the same `PLANS` table the cards read. Structured
 * data that disagrees with the visible page is a manual-action risk, so there
 * is deliberately no second copy of anything to drift from.
 *
 * Server-side only — it imports all five catalogs, which have no business in a
 * client bundle.
 */
import en, { type Messages } from '@/i18n/messages/en'
import fr from '@/i18n/messages/fr'
import es from '@/i18n/messages/es'
import de from '@/i18n/messages/de'
import ar from '@/i18n/messages/ar'
import type { Locale } from '@/i18n/I18nProvider'
import { PLANS, type PlanTier } from '@/lib/billing/plans'
import { localePath, type MarketingPath } from './locales'
import { CONTENT_UPDATED, siteUrl } from './site'

const CATALOGS: Record<Locale, Messages> = { en, fr, es, de, ar }

/** The languages the graph advertises, as schema.org `inLanguage` values. */
const GRAPH_LANGUAGES = Object.keys(CATALOGS)

/** A node in a `@graph`; loose on purpose, since schema.org shapes vary per type. */
type Node = Record<string, unknown>

/* Fragment ids are per-locale below the site level, so the French page's
   product node is a distinct entity from the English one rather than two URLs
   claiming one `@id`. The organisation and the site are shared. */
function ids(base: string, locale: Locale) {
    const home = `${base}${localePath(locale, '/')}`
    return {
        org: `${base}/#organization`,
        site: `${base}/#website`,
        app: `${home}#software`,
        faq: `${home}#faq`,
        howto: `${home}#howto`,
    }
}

/* The publisher, and the only node shared across locales — the company is the
   same entity whichever language you read about it in.

   Deliberately missing: `sameAs`, `contactPoint` and `address`. Those are the
   strongest entity-disambiguation signals an AI search engine has, but the
   repository holds no real social profiles, support address or postal address,
   and inventing them would put false claims into machine-readable form. */
function organization(base: string): Node {
    return {
        '@type': 'Organization',
        '@id': `${base}/#organization`,
        name: 'BorsFlow',
        url: `${base}/`,
        description: en.landing.footer.tagline,
        logo: {
            '@type': 'ImageObject',
            url: `${base}/icons/icon-512x512.png`,
            width: 512,
            height: 512,
        },
    }
}

function website(base: string, locale: Locale): Node {
    const m = CATALOGS[locale]
    return {
        '@type': 'WebSite',
        '@id': `${base}/#website`,
        url: `${base}/`,
        name: 'BorsFlow',
        description: `${m.landing.hero.titleLine1} ${m.landing.hero.titleLine2}. ${m.landing.hero.lead}`,
        inLanguage: GRAPH_LANGUAGES,
        publisher: { '@id': `${base}/#organization` },
    }
}

/* Paid tiers are on the waitlist, not on sale, so they are offered as PreOrder
   while Free is InStock — which is exactly what the pricing cards say. */
function planOffer(base: string, locale: Locale, tier: PlanTier): Node | null {
    const plan = PLANS[tier]
    if (plan.priceMonthly === null) return null
    return {
        '@type': 'Offer',
        name: plan.name,
        description: plan.tagline,
        url: `${base}${localePath(locale, '/pricing')}`,
        price: plan.priceMonthly,
        priceCurrency: 'USD',
        availability:
            tier === 'FREE' ? 'https://schema.org/InStock' : 'https://schema.org/PreOrder',
        priceSpecification: {
            '@type': 'UnitPriceSpecification',
            price: plan.priceMonthly,
            priceCurrency: 'USD',
            unitCode: 'MON',
            referenceQuantity: {
                '@type': 'QuantitativeValue',
                value: 1,
                unitCode: 'MON',
            },
        },
    }
}

/* The product itself. `applicationCategory` plus the feature list is what AI
   search engines read to decide what this tool *is*; without it they have to
   infer the category from prose. The screenshots are the same captures the
   page shows, which is what makes them answerable to the claim. */
function softwareApplication(base: string, locale: Locale): Node {
    const m = CATALOGS[locale]
    const tiers: PlanTier[] = ['FREE', 'STARTER', 'PRO', 'BUSINESS']
    const offers = tiers
        .map((t) => planOffer(base, locale, t))
        .filter((o): o is Node => o !== null)
    const prices = tiers.map((t) => PLANS[t].priceMonthly).filter((p): p is number => p !== null)

    return {
        '@type': 'SoftwareApplication',
        '@id': ids(base, locale).app,
        name: 'BorsFlow',
        url: `${base}${localePath(locale, '/')}`,
        applicationCategory: 'BusinessApplication',
        applicationSubCategory: 'Real estate agency CRM',
        operatingSystem: 'Web browser',
        description: m.landing.hero.lead,
        image: `${base}/opengraph-image`,
        screenshot: [
            {
                '@type': 'ImageObject',
                url: `${base}/shots/crm.webp`,
                caption: m.landing.hero.plateAlt,
            },
            {
                '@type': 'ImageObject',
                url: `${base}/shots/pages.webp`,
                caption: m.landing.evidence.editorAlt,
            },
            {
                '@type': 'ImageObject',
                url: `${base}/shots/invoices.webp`,
                caption: m.landing.evidence.financialsAlt,
            },
        ],
        softwareVersion: '1.0',
        inLanguage: GRAPH_LANGUAGES,
        publisher: { '@id': `${base}/#organization` },
        featureList: [
            'Property inventory with photos and a public listing page',
            'Owner mandates with an expiry work queue',
            'Buyer pipeline, search briefs and new-listing matching',
            'Viewings with structured feedback',
            'Competing offers with atomic acceptance',
            'Commission splits per agent and forecast',
            'Block-based documents and pages',
            'Quotes and invoices with PDF export',
            'Email campaigns, segments and automations',
            'Meeting scheduling with calendar sync',
            'AI assistant scoped to workspace permissions',
            'Role-based access for owners, admins, members and viewers',
        ],
        offers: {
            '@type': 'AggregateOffer',
            priceCurrency: 'USD',
            lowPrice: Math.min(...prices),
            highPrice: Math.max(...prices),
            offerCount: offers.length,
            offers,
        },
    }
}

/* The six questions the landing page answers out loud. Answer engines lift
   these verbatim, so the text is the catalog string — not a paraphrase. */
function faqPage(base: string, locale: Locale): Node {
    const faq = CATALOGS[locale].landing.support
    const pairs: [string, string][] = [
        [faq.faq1q, faq.faq1a],
        [faq.faq2q, faq.faq2a],
        [faq.faq3q, faq.faq3a],
        [faq.faq4q, faq.faq4a],
        [faq.faq5q, faq.faq5a],
        [faq.faq6q, faq.faq6a],
    ]

    return {
        '@type': 'FAQPage',
        '@id': ids(base, locale).faq,
        inLanguage: locale,
        mainEntity: pairs.map(([question, answer]) => ({
            '@type': 'Question',
            name: question,
            acceptedAnswer: { '@type': 'Answer', text: answer },
        })),
    }
}

/* The "how it works" section is already four ordered steps in an <ol>; this is
   that same sequence in the form an answer engine can lift into a step-by-step
   result. Without it the steps are four spans inside buttons and nothing more. */
function howTo(base: string, locale: Locale): Node {
    const j = CATALOGS[locale].landing.journey
    const steps: [string, string][] = [
        [j.stage1Title, j.stage1Body],
        [j.stage2Title, j.stage2Body],
        [j.stage3Title, j.stage3Body],
        [j.stage4Title, j.stage4Body],
    ]

    return {
        '@type': 'HowTo',
        '@id': ids(base, locale).howto,
        name: j.heading,
        description: j.lead,
        inLanguage: locale,
        step: steps.map(([name, text], i) => ({
            '@type': 'HowToStep',
            position: i + 1,
            name,
            text,
            url: `${base}${localePath(locale, '/')}#journey`,
        })),
    }
}

/* The page as its own entity: it ties the rest of the graph to this one URL
   and carries the only freshness signal the site has. */
function webPage(
    base: string,
    locale: Locale,
    path: MarketingPath,
    name: string,
    description: string,
): Node {
    const i = ids(base, locale)
    const url = `${base}${localePath(locale, path)}`
    return {
        '@type': 'WebPage',
        '@id': `${url}#webpage`,
        url,
        name,
        description,
        inLanguage: locale,
        isPartOf: { '@id': i.site },
        about: { '@id': i.app },
        primaryImageOfPage: { '@type': 'ImageObject', url: `${base}/opengraph-image` },
        datePublished: CONTENT_UPDATED,
        dateModified: CONTENT_UPDATED,
    }
}

/**
 * Title and description for a marketing page, in its own language.
 *
 * Lives here because this is the one server module that holds the catalogs, so
 * the translated routes do not each have to import five of them to get a
 * title. The strings are the page's own headline and lead — a search snippet
 * that matches the page it opens.
 */
export function pageMeta(
    locale: Locale,
    path: MarketingPath,
): { title: string; description: string } {
    const m = CATALOGS[locale]
    if (path === '/pricing') {
        return { title: m.landing.pricing.heading, description: m.landing.pricing.lead }
    }
    return {
        title: `${m.landing.hero.titleLine1} ${m.landing.hero.titleLine2}`,
        description: m.landing.hero.lead,
    }
}

/** The homepage graph: publisher, site, page, product, FAQ and the four steps. */
export function homeGraph(locale: Locale): Node {
    const base = siteUrl()
    const m = CATALOGS[locale]
    return {
        '@context': 'https://schema.org',
        '@graph': [
            organization(base),
            website(base, locale),
            webPage(
                base,
                locale,
                '/',
                `${m.landing.hero.titleLine1} ${m.landing.hero.titleLine2}`,
                m.landing.hero.lead,
            ),
            softwareApplication(base, locale),
            faqPage(base, locale),
            howTo(base, locale),
        ],
    }
}

/** The pricing page graph: the same product, its offers, and the trail to it. */
export function pricingGraph(locale: Locale): Node {
    const base = siteUrl()
    const m = CATALOGS[locale]
    return {
        '@context': 'https://schema.org',
        '@graph': [
            organization(base),
            webPage(base, locale, '/pricing', m.landing.pricing.heading, m.landing.pricing.lead),
            softwareApplication(base, locale),
            {
                '@type': 'BreadcrumbList',
                itemListElement: [
                    {
                        '@type': 'ListItem',
                        position: 1,
                        name: 'Home',
                        item: `${base}${localePath(locale, '/')}`,
                    },
                    {
                        '@type': 'ListItem',
                        position: 2,
                        name: m.landing.pricing.heading,
                        item: `${base}${localePath(locale, '/pricing')}`,
                    },
                ],
            },
        ],
    }
}
