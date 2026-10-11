/**
 * Demo data for the estate agency experience, used to capture the landing page
 * screenshots: a Dublin agency with listings, vendors, buyers, viewings, competing
 * offers and commissions, priced in EUR.
 *
 *   npx tsx scripts/demo/seed-agency.ts            create (refuses if it exists)
 *   npx tsx scripts/demo/seed-agency.ts --reset    delete the demo, then create
 *   npx tsx scripts/demo/seed-agency.ts --remove   delete the demo only
 *
 * Only ever touches the accounts in AGENCY_DEMO_USERS, the workspace they own and
 * that workspace's files in storage. Like seed-developer.ts, the data goes through
 * the real services (mandate, list, view, offer, accept, sell, pay) so boards,
 * stages and commissions are what the app itself would produce, and the history
 * is spread over the last months afterwards with direct updates.
 *
 * Email safety: demo users have notificationsEmail off, and every contact uses an
 * address at example.com, which delivers to nobody.
 */
import { loadEnv, AGENCY_DEMO_USERS, demoPassword, AGENCY_DEMO_WORKSPACE_NAME } from './env'

loadEnv()

const DAY = 24 * 60 * 60 * 1000
const now = new Date()
const daysAgo = (d: number, hour = 10) => {
  const date = new Date(now.getTime() - d * DAY)
  date.setHours(hour, (d * 7) % 60, 0, 0)
  return date
}
const daysAhead = (d: number, hour = 10) => daysAgo(-d, hour)

/** Deterministic randomness, so --reset gives the same demo every time. */
let seed = 20261011
const rand = () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296
  return seed / 4294967296
}
const pick = <T,>(items: readonly T[]): T => items[Math.floor(rand() * items.length)]
const between = (min: number, max: number) => min + Math.floor(rand() * (max - min + 1))
const roundTo = (n: number, step: number) => Math.round(n / step) * step

const FIRST_NAMES = [
  'Siobhan', 'Conor', 'Niamh', 'Darragh', 'Orla', 'Cian', 'Ciara', 'Eoin', 'Sinead', 'Padraig',
  'Grainne', 'Fionn', 'Emma', 'Liam', 'Sarah', 'James', 'Aisling', 'Tadhg', 'Roisin', 'Declan',
  'Laura', 'Oisin', 'Clodagh', 'Shane', 'Maeve', 'Kevin', 'Hannah', 'Dermot', 'Sophie', 'Colm',
  'Ella', 'Brian', 'Deirdre', 'Mark', 'Una', 'Killian',
]
const LAST_NAMES = [
  'Murphy', 'Kelly', "O'Sullivan", 'Byrne', 'Ryan', "O'Brien", 'Doyle', 'McCarthy', 'Gallagher', "O'Connor",
  'Kennedy', 'Lynch', 'Quinn', 'Moore', 'McLoughlin', 'Farrell', 'Nolan', 'Keane', 'Fitzgerald', 'Hughes',
  'Daly', 'Power', 'Kavanagh', 'Dunne', 'Brady', 'Reilly',
]

const ascii = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z]/g, '').toLowerCase()

/** Listing photos, downloaded once and uploaded per property so the agent screens show them. */
const PHOTOS = {
  house: [
    'photo-1568605114967-8130f3a36994',
    'photo-1570129477492-45c003edd2be',
    'photo-1564013799919-ab600027ffc6',
    'photo-1580587771525-78b9dba3b914',
    'photo-1512917774080-9991f1c4c750',
    'photo-1600596542815-ffad4c1539a9',
  ],
  apartment: [
    'photo-1545324418-cc1a3fa10c00',
    'photo-1460317442991-0ec209397118',
    'photo-1502672260266-1c1ef2d93688',
    'photo-1522708323590-d24dbb6b0267',
  ],
  interior: [
    'photo-1560448204-e02f11c3d0e2',
    'photo-1600585154340-be6161a56a0c',
    'photo-1502005229762-cf1b2da7c5d6',
  ],
  commercial: ['photo-1441986300917-64674bd600d8'],
  land: ['photo-1500382017468-9049fed747ef'],
}
const unsplash = (id: string) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=1400&q=78`

/**
 * The agency's stock. `plan` is where the listing ends up:
 *   prospect / valuation -> not yet signed
 *   mandate              -> signed, not yet live
 *   live                 -> on the market, `offers` pending
 *   under_offer          -> an offer accepted, sale pending
 *   sold / paid          -> sale closed, commission realized (and paid)
 */
type Plan = 'prospect' | 'valuation' | 'mandate' | 'live' | 'under_offer' | 'sold' | 'paid'
type Spec = {
  title: string; district: string; postalCode: string; address: string; type: string; price: number
  bedrooms?: number; bathrooms?: number; surface: number; rating?: string; plan: Plan
  offers?: number; viewings: number; agent: 'owner' | 'ronan' | 'aoife'; listedDaysAgo: number
  photo: keyof typeof PHOTOS; extras?: Record<string, boolean>; description: string
}
const STOCK: Spec[] = [
  {
    title: 'Victorian terrace with walled garden', district: 'Ranelagh', postalCode: 'D06', address: '14 Mornington Road',
    type: 'house', price: 685_000, bedrooms: 3, bathrooms: 2, surface: 128, rating: 'C', plan: 'live', offers: 3, viewings: 7,
    agent: 'owner', listedDaysAgo: 24, photo: 'house', extras: { hasGarden: true },
    description: 'Red-brick terrace on a quiet tree-lined road, five minutes from the Luas. Original coving and fireplaces, a modern kitchen extension and a south-facing walled garden.',
  },
  {
    title: 'Two-bed apartment with dock views', district: 'Grand Canal Dock', postalCode: 'D02', address: 'Apt 41, Hanover Quay',
    type: 'apartment', price: 495_000, bedrooms: 2, bathrooms: 2, surface: 82, rating: 'A', plan: 'under_offer', offers: 2, viewings: 5,
    agent: 'ronan', listedDaysAgo: 41, photo: 'apartment', extras: { hasElevator: true, hasBalcony: true, hasParking: true },
    description: 'Fourth-floor corner apartment with a balcony over the water, an allocated parking space and a concierge.',
  },
  {
    title: 'Family semi-detached near the seafront', district: 'Clontarf', postalCode: 'D03', address: '22 Seafield Avenue',
    type: 'house', price: 875_000, bedrooms: 4, bathrooms: 3, surface: 165, rating: 'B', plan: 'paid', offers: 2, viewings: 6,
    agent: 'owner', listedDaysAgo: 118, photo: 'house', extras: { hasGarden: true, hasParking: true },
    description: 'Extended four-bed semi a short walk from the promenade, with off-street parking and a large rear garden.',
  },
  {
    title: 'Bright one-bed off Rathmines Road', district: 'Rathmines', postalCode: 'D06', address: 'Apt 7, Leinster Square',
    type: 'apartment', price: 310_000, bedrooms: 1, bathrooms: 1, surface: 48, rating: 'C', plan: 'live', offers: 0, viewings: 3,
    agent: 'aoife', listedDaysAgo: 12, photo: 'apartment',
    description: 'First-floor one-bed in a period square, ideal first home or investment.',
  },
  {
    title: 'Three-bed semi close to DCU', district: 'Drumcondra', postalCode: 'D09', address: '9 Hollybank Road',
    type: 'house', price: 545_000, bedrooms: 3, bathrooms: 2, surface: 112, rating: 'C', plan: 'live', offers: 2, viewings: 5,
    agent: 'ronan', listedDaysAgo: 19, photo: 'house', extras: { hasGarden: true },
    description: 'Well kept three-bed semi with a converted attic, near Griffith Park and the city centre.',
  },
  {
    title: 'Clifftop home with harbour views', district: 'Howth', postalCode: 'D13', address: 'Kilrock, Balkill Road',
    type: 'house', price: 1_250_000, bedrooms: 4, bathrooms: 3, surface: 210, rating: 'B', plan: 'under_offer', offers: 3, viewings: 6,
    agent: 'owner', listedDaysAgo: 56, photo: 'house', extras: { hasGarden: true, hasParking: true, hasTerrace: true },
    description: 'Architect-designed four-bed overlooking Howth harbour and Ireland’s Eye, with a wraparound terrace.',
  },
  {
    title: 'Artisan cottage in Stoneybatter', district: 'Stoneybatter', postalCode: 'D07', address: '31 Oxmantown Road',
    type: 'house', price: 425_000, bedrooms: 2, bathrooms: 1, surface: 68, rating: 'D', plan: 'sold', offers: 2, viewings: 5,
    agent: 'aoife', listedDaysAgo: 87, photo: 'house', extras: { hasGarden: true },
    description: 'Charming two-bed cottage with a sunny courtyard, in one of Dublin’s most sought-after villages.',
  },
  {
    title: 'Penthouse with roof terrace', district: 'Sandymount', postalCode: 'D04', address: 'Penthouse 3, Strand Road',
    type: 'apartment', price: 980_000, bedrooms: 3, bathrooms: 2, surface: 135, rating: 'A', plan: 'live', offers: 1, viewings: 4,
    agent: 'owner', listedDaysAgo: 9, photo: 'apartment', extras: { hasElevator: true, hasTerrace: true, hasParking: true },
    description: 'Top-floor penthouse facing Sandymount Strand, with a 60 m² roof terrace and two parking spaces.',
  },
  {
    title: 'Detached five-bed on an acre', district: 'Malahide', postalCode: 'K36', address: 'Glenmore, Yellow Walls Road',
    type: 'house', price: 1_450_000, bedrooms: 5, bathrooms: 4, surface: 290, rating: 'B', plan: 'mandate', viewings: 0,
    agent: 'ronan', listedDaysAgo: 3, photo: 'house', extras: { hasGarden: true, hasParking: true },
    description: 'Substantial detached family home on mature grounds, close to Malahide village and the DART.',
  },
  {
    title: 'Two-bed apartment by the DART', district: 'Blackrock', postalCode: 'A94', address: 'Apt 12, Frescati Park',
    type: 'apartment', price: 465_000, bedrooms: 2, bathrooms: 2, surface: 77, rating: 'B', plan: 'live', offers: 1, viewings: 4,
    agent: 'aoife', listedDaysAgo: 30, photo: 'apartment', extras: { hasElevator: true, hasParking: true },
    description: 'Second-floor apartment with a private balcony, minutes from Blackrock village and the DART.',
  },
  {
    title: 'Retail unit on Camden Street', district: 'Dublin 2', postalCode: 'D02', address: '58 Camden Street Lower',
    type: 'commercial', price: 720_000, surface: 140, plan: 'live', offers: 0, viewings: 2,
    agent: 'ronan', listedDaysAgo: 45, photo: 'commercial',
    description: 'Ground-floor retail unit with full frontage on one of the city’s busiest streets. Sold with tenant in place.',
  },
  {
    title: 'Development site with planning', district: 'Rathfarnham', postalCode: 'D14', address: 'Site at Grange Road',
    type: 'land', price: 390_000, surface: 1_800, plan: 'valuation', viewings: 0,
    agent: 'owner', listedDaysAgo: 2, photo: 'land',
    description: 'Level site with planning permission for two detached homes.',
  },
  {
    title: 'Three-bed townhouse in Phibsborough', district: 'Phibsborough', postalCode: 'D07', address: '5 Royal Canal Terrace',
    type: 'house', price: 510_000, bedrooms: 3, bathrooms: 2, surface: 104, rating: 'B', plan: 'paid', offers: 2, viewings: 5,
    agent: 'ronan', listedDaysAgo: 140, photo: 'house',
    description: 'Modern townhouse overlooking the Royal Canal, with an open-plan living space and a patio garden.',
  },
  {
    title: 'Duplex above the harbour', district: 'Dún Laoghaire', postalCode: 'A96', address: 'Apt 2, Crofton Road',
    type: 'apartment', price: 440_000, bedrooms: 2, bathrooms: 2, surface: 90, rating: 'C', plan: 'under_offer', offers: 2, viewings: 4,
    agent: 'aoife', listedDaysAgo: 34, photo: 'apartment', extras: { hasBalcony: true },
    description: 'Two-level duplex with sea views, walking distance from the pier and the DART.',
  },
  {
    title: 'Georgian garden flat', district: 'Portobello', postalCode: 'D08', address: 'Garden Flat, 19 Synge Street',
    type: 'apartment', price: 375_000, bedrooms: 1, bathrooms: 1, surface: 58, rating: 'D', plan: 'prospect', viewings: 0,
    agent: 'aoife', listedDaysAgo: 1, photo: 'apartment',
    description: 'Garden-level flat in a Georgian house, with its own entrance and patio.',
  },
]

const FEEDBACK = [
  'Loved the light in the kitchen, wants to bring their partner back for a second look.',
  'Good location for the school run, worried the garden is small.',
  'Very keen, asked about the survey and service charges.',
  'Liked it but thinks the asking price is ambitious.',
  'Layout works for them, would need to sell their own place first.',
  'Second viewing, discussing an offer with their broker.',
]

async function main() {
  const args = new Set(process.argv.slice(2))
  const { prisma } = await import('../../src/lib/prisma')
  // The remote pooler drops idle connections and the line here is not always
  // steady; retry a query that failed for that reason instead of losing the run.
  const TRANSIENT = new Set(['P1001', 'P1017', 'P2024'])
  prisma.$use(async (params, next) => {
    for (let attempt = 1; ; attempt++) {
      try {
        return await next(params)
      } catch (e: any) {
        if (!TRANSIENT.has(e?.code) || attempt >= 12) throw e
        console.warn(`  retrying ${params.model}.${params.action} after ${e.code}`)
        await new Promise((r) => setTimeout(r, Math.min(20_000, 2000 * attempt)))
      }
    }
  })
  const { getSupabaseAdmin, CRM_BUCKET } = await import('../../src/lib/supabase-admin')
  const bcrypt = (await import('bcryptjs')).default

  const demoEmails = AGENCY_DEMO_USERS.map((u) => u.email)
  const supabase = getSupabaseAdmin()

  /** Every file under crm/<workspaceId>/properties, so --remove leaves nothing behind. */
  async function removeStorage(workspaceId: string) {
    if (!supabase) return
    const root = `crm/${workspaceId}/properties`
    const { data: folders } = await supabase.storage.from(CRM_BUCKET).list(root, { limit: 1000 })
    for (const folder of folders ?? []) {
      const { data: files } = await supabase.storage.from(CRM_BUCKET).list(`${root}/${folder.name}`, { limit: 1000 })
      const paths = (files ?? []).map((f) => `${root}/${folder.name}/${f.name}`)
      if (paths.length) await supabase.storage.from(CRM_BUCKET).remove(paths)
    }
  }

  // ── Remove ────────────────────────────────────────────────────────────────
  const existing = await prisma.user.findMany({ where: { email: { in: demoEmails } }, select: { id: true } })
  if (existing.length > 0) {
    if (!args.has('--reset') && !args.has('--remove')) {
      console.log('The agency demo already exists. Run with --reset to recreate it, or --remove to delete it.')
      return
    }
    const ids = existing.map((u) => u.id)
    const workspaces = await prisma.workspace.findMany({ where: { ownerId: { in: ids } }, select: { id: true, name: true } })
    for (const ws of workspaces) {
      await removeStorage(ws.id)
      await prisma.workspace.delete({ where: { id: ws.id } })
      console.log(`Deleted demo workspace "${ws.name}"`)
    }
    await prisma.user.deleteMany({ where: { id: { in: ids }, email: { in: demoEmails } } })
    console.log(`Deleted ${ids.length} demo users`)
    if (args.has('--remove')) return
  } else if (args.has('--remove')) {
    console.log('No agency demo to remove.')
    return
  }

  const { ensureDefaultPipelines } = await import('../../src/lib/services/pipelines')
  const { createLead } = await import('../../src/lib/services/leads')
  const { createProperty, updateProperty } = await import('../../src/lib/services/properties')
  const { createMandate } = await import('../../src/lib/services/mandates')
  const { createInterest, updateInterest } = await import('../../src/lib/services/interests')
  const { createViewing, recordViewingFeedback } = await import('../../src/lib/services/viewings')
  const { createOffer, acceptOffer } = await import('../../src/lib/services/offers')
  const { markPaid } = await import('../../src/lib/services/commissions')
  const { mediaStoragePrefix } = await import('../../src/lib/crm/media-storage')

  if (!supabase) console.warn('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set: listings will have no photos.')

  // ── Accounts and workspace ────────────────────────────────────────────────
  const password = await bcrypt.hash(demoPassword(), 12)
  const users: Record<string, string> = {}
  for (const u of AGENCY_DEMO_USERS) {
    const user = await prisma.user.create({
      data: {
        email: u.email,
        name: u.name,
        password,
        emailVerified: daysAgo(200),
        businessType: 'AGENCY',
        notificationsEmail: false,
        createdAt: daysAgo(200),
      },
    })
    users[u.key] = user.id
  }
  const ownerId = users.owner
  const agents = [users.owner, users.ronan, users.aoife]

  const workspace = await prisma.workspace.create({
    data: {
      name: AGENCY_DEMO_WORKSPACE_NAME,
      description: 'Residential sales and lettings, south and north Dublin',
      icon: '🏡',
      currency: 'EUR',
      ownerId,
      createdAt: daysAgo(200),
    },
  })
  const workspaceId = workspace.id
  for (const u of AGENCY_DEMO_USERS.filter((u) => u.role !== 'owner')) {
    await prisma.workspaceMember.create({ data: { workspaceId, userId: users[u.key], role: u.role } })
  }
  await ensureDefaultPipelines(workspaceId)
  const contacts = await prisma.pipeline.findFirstOrThrow({
    where: { workspaceId, subjectType: 'Lead' },
    select: { id: true, workspaceId: true, stages: true },
  })

  const as = (userId: string) => ({ workspaceId, userId })

  // ── Photos ────────────────────────────────────────────────────────────────
  const photoCache = new Map<string, Buffer>()
  async function photo(id: string): Promise<Buffer | null> {
    if (photoCache.has(id)) return photoCache.get(id)!
    try {
      let buffer: Buffer | null = null
      for (let attempt = 1; !buffer; attempt++) {
        try {
          const res = await fetch(unsplash(id), { signal: AbortSignal.timeout(90_000) })
          if (!res.ok) throw new Error(`HTTP ${res.status}`)
          buffer = Buffer.from(await res.arrayBuffer())
        } catch (e) {
          if (attempt >= 4) throw e
          await new Promise((r) => setTimeout(r, 1500 * attempt))
        }
      }
      photoCache.set(id, buffer)
      return buffer
    } catch (e) {
      console.warn(`  photo ${id} skipped: ${(e as Error).message}`)
      return null
    }
  }
  async function attachPhotos(propertyId: string, ids: string[], uploadedById: string) {
    if (!supabase) return
    for (const [position, id] of ids.entries()) {
      const buffer = await photo(id)
      if (!buffer) continue
      const filePath = `${mediaStoragePrefix('properties', workspaceId, propertyId)}/${id}.jpg`
      const { error } = await supabase.storage.from(CRM_BUCKET).upload(filePath, buffer, { contentType: 'image/jpeg', upsert: true })
      if (error) { console.warn(`  upload failed: ${error.message}`); continue }
      await prisma.propertyMedia.create({
        data: {
          propertyId, workspaceId, kind: 'photo', filePath, fileName: `${id}.jpg`, fileType: 'image/jpeg',
          size: buffer.length, position, isCover: position === 0, uploadedById,
        },
      })
    }
  }

  // Download every photo up front: a slow fetch between database calls leaves the
  // pooled connections idle long enough for the pooler to drop them.
  for (const id of Object.values(PHOTOS).flat()) await photo(id)
  console.log(`${photoCache.size} photos downloaded`)

  // ── People ────────────────────────────────────────────────────────────────
  const usedNames = new Set<string>()
  async function makeContact(opts: { stage: string; createdDaysAgo: number; budget?: number; source: string }) {
    let first = '', last = ''
    do { first = pick(FIRST_NAMES); last = pick(LAST_NAMES) } while (usedNames.has(first + last))
    usedNames.add(first + last)
    const lead = await createLead(contacts, {
      firstName: first,
      lastName: last,
      email: `${ascii(first)}.${ascii(last)}@example.com`,
      phone: `+353 8${between(3, 7)} ${between(100, 999)} ${between(1000, 9999)}`,
      stage: opts.stage,
      source: opts.source,
      value: opts.budget,
      ownerId: pick(agents),
    } as any)
    await prisma.lead.update({ where: { id: lead.id }, data: { createdAt: daysAgo(opts.createdDaysAgo), createdById: ownerId } })
    return lead
  }

  // A pool of buyers who move between listings, like real ones do.
  const BUYER_SOURCES = ['website', 'portal', 'portal', 'referral', 'walk_in', 'instagram', 'phone']
  const buyers: { id: string }[] = []
  for (let i = 0; i < 30; i++) {
    buyers.push(await makeContact({
      stage: pick(['New', 'Contacted', 'Qualified', 'Qualified', 'Nurturing']),
      createdDaysAgo: between(5, 150),
      budget: roundTo(between(300, 1300) * 1000, 5000),
      source: pick(BUYER_SOURCES),
    }))
  }
  console.log(`${buyers.length} buyers`)

  // ── Listings ──────────────────────────────────────────────────────────────
  const started = Date.now()
  const step = (label: string) => console.log(`  [${Math.round((Date.now() - started) / 1000)}s] ${label}`)
  const commissionsToPay: string[] = []
  let buyerCursor = 0
  const nextBuyer = () => buyers[buyerCursor++ % buyers.length]

  for (const [index, spec] of STOCK.entries()) {
    const agentId = users[spec.agent]
    const actor = as(agentId)
    const listed = spec.listedDaysAgo
    const vendor = await makeContact({ stage: 'Qualified', createdDaysAgo: listed + between(10, 30), source: pick(['referral', 'website', 'walk_in']) })

    const property = await createProperty(actor, {
      title: spec.title,
      city: 'Dublin',
      district: spec.district,
      postalCode: spec.postalCode,
      addressLine: spec.address,
      countryCode: 'IE',
      propertyType: spec.type,
      transactionType: 'sale',
      price: spec.price,
      bedrooms: spec.bedrooms,
      bathrooms: spec.bathrooms,
      surfaceArea: spec.type === 'land' ? undefined : spec.surface,
      landArea: spec.type === 'land' ? spec.surface : undefined,
      energyRating: spec.rating,
      description: spec.description,
      vendorId: vendor.id,
      ownerId: agentId,
      status: spec.plan === 'valuation' ? 'valuation' : 'prospect',
      ...(spec.extras ?? {}),
    })

    const photos = [PHOTOS[spec.photo][index % PHOTOS[spec.photo].length]]
    if (spec.type === 'house' || spec.type === 'apartment') {
      photos.push(PHOTOS.interior[index % PHOTOS.interior.length], PHOTOS.interior[(index + 1) % PHOTOS.interior.length])
    }
    step(`${property.reference} created`)
    await attachPhotos(property.id, photos, agentId)
    step(`${property.reference} photos`)

    if (spec.plan === 'prospect' || spec.plan === 'valuation') {
      await prisma.property.update({ where: { id: property.id }, data: { createdAt: daysAgo(listed) } })
      console.log(`${property.reference} ${spec.title}: ${spec.plan}`)
      continue
    }

    await createMandate(actor, {
      propertyId: property.id,
      leadId: vendor.id,
      status: 'active',
      mandateType: index % 3 === 0 ? 'simple' : 'exclusive',
      feeType: 'percent',
      commissionPercent: spec.type === 'commercial' ? 2 : 1.5,
      feePayer: 'vendor',
      signedAt: daysAgo(listed + 4).toISOString(),
      startDate: daysAgo(listed + 4).toISOString(),
      endDate: daysAhead(180 - listed).toISOString(),
      askingPrice: spec.price,
      reportEveryDays: 14,
    })
    if (spec.plan === 'mandate') {
      await prisma.property.update({ where: { id: property.id }, data: { createdAt: daysAgo(listed + 6) } })
      console.log(`${property.reference} ${spec.title}: mandate`)
      continue
    }

    await updateProperty(property.id, actor, { status: 'live', isPublished: true })
    step(`${property.reference} live`)

    // Viewings: most done with feedback, the last one or two still to come.
    const viewers: { leadId: string; interestId: string; meetingId: string; done: boolean }[] = []
    for (let v = 0; v < spec.viewings; v++) {
      const buyer = nextBuyer()
      const upcoming = spec.plan === 'live' && v >= spec.viewings - Math.min(2, spec.viewings - (spec.offers ?? 0))
      const when = upcoming ? daysAhead(between(1, 6), between(10, 17)) : daysAgo(Math.max(1, listed - between(2, Math.max(3, listed - 2))), between(10, 17))
      const viewing = await createViewing(as(pick(agents)), { propertyId: property.id, leadId: buyer.id, startTime: when.toISOString(), duration: 30 })
      if (!upcoming) {
        await recordViewingFeedback(viewing.id, actor, {
          attended: true,
          interestLevel: between(2, 5),
          priceVerdict: pick(['neutral', 'negative', 'neutral', 'positive']),
          conditionVerdict: pick(['positive', 'positive', 'neutral']),
          locationVerdict: pick(['positive', 'positive', 'neutral']),
          layoutVerdict: pick(['positive', 'neutral', 'negative']),
          comments: pick(FEEDBACK),
        })
      }
      step(`${property.reference} viewing ${v + 1}`)
      viewers.push({ leadId: buyer.id, interestId: viewing.interestId!, meetingId: viewing.id, done: !upcoming })
    }

    // Buyers who only enquired so far, so the board has a top of funnel.
    for (let e = 0; e < between(1, 3); e++) {
      const buyer = nextBuyer()
      try {
        const interest = await createInterest(as(pick(agents)), {
          leadId: buyer.id, propertyId: property.id, source: pick(['enquiry', 'portal', 'match']),
          stage: pick(['Enquiry', 'Enquiry', 'Qualified', 'Brief recorded']),
        })
        await prisma.interest.update({ where: { id: interest.id }, data: { createdAt: daysAgo(between(0, Math.min(listed, 10))) } })
      } catch { /* already attached to this listing */ }
    }

    // Competing offers from the buyers who viewed, around the asking price.
    const bidders = spec.offers ? viewers.filter((v) => v.done).slice(-spec.offers) : []
    const offers: { id: string; amount: number }[] = []
    for (const [o, bidder] of bidders.entries()) {
      const amount = roundTo(spec.price * (0.94 + o * 0.025 + rand() * 0.02), 5000)
      const offer = await createOffer(as(pick(agents)), {
        interestId: bidder.interestId,
        amount,
        financingType: pick(['mortgage', 'mortgage', 'cash', 'mixed']),
        depositAmount: roundTo(amount * 0.1, 1000),
        expiresAt: daysAhead(between(5, 14)).toISOString(),
        conditions: rand() > 0.4 ? [{ type: 'finance', note: 'Subject to mortgage approval' }, { type: 'survey', note: 'Subject to structural survey' }] : [],
      })
      await prisma.offer.update({ where: { id: offer.id }, data: { offeredAt: daysAgo(Math.max(1, Math.round(listed / 3) - o)), createdAt: daysAgo(Math.max(1, Math.round(listed / 3) - o)) } })
      offers.push({ id: offer.id, amount })
    }

    if (['under_offer', 'sold', 'paid'].includes(spec.plan) && offers.length) {
      const best = offers.reduce((a, b) => (b.amount > a.amount ? b : a))
      await acceptOffer(best.id, actor)
      await prisma.offer.update({ where: { id: best.id }, data: { decidedAt: daysAgo(Math.max(1, Math.round(listed / 4))) } })
      if (spec.plan === 'sold' || spec.plan === 'paid') {
        await updateProperty(property.id, actor, { status: 'sold', soldPrice: best.amount })
        const winner = await prisma.offer.findUniqueOrThrow({ where: { id: best.id }, select: { interestId: true } })
        await updateInterest(winner.interestId, actor, { stage: 'Closed' }).catch(() => {})
        const commission = await prisma.commission.findFirst({ where: { propertyId: property.id, status: 'realized' }, select: { id: true } })
        const closed = daysAgo(Math.max(2, Math.round(listed / 6)))
        await prisma.property.update({ where: { id: property.id }, data: { soldAt: closed } })
        if (commission) {
          await prisma.commission.update({ where: { id: commission.id }, data: { realizedAt: closed, createdAt: daysAgo(Math.round(listed / 4)) } })
          if (spec.plan === 'paid') commissionsToPay.push(commission.id)
        }
      } else {
        await prisma.commission.updateMany({ where: { propertyId: property.id }, data: { createdAt: daysAgo(Math.max(1, Math.round(listed / 4))) } })
      }
    }

    await prisma.property.update({ where: { id: property.id }, data: { createdAt: daysAgo(listed + 6), listedAt: daysAgo(listed) } })
    console.log(`${property.reference} ${spec.title}: ${spec.plan}, ${viewers.length} viewings, ${offers.length} offers`)
  }

  for (const id of commissionsToPay) {
    await markPaid(id, { workspaceId, userId: ownerId, canModerate: true })
    await prisma.commission.update({ where: { id }, data: { paidAt: daysAgo(between(1, 10)) } })
  }

  // Spread the buyer board's activity so cards do not all say "just now".
  const fresh = new Date(now.getTime() - DAY / 2)
  const interests = await prisma.interest.findMany({ where: { workspaceId }, select: { id: true, createdAt: true } })
  for (const i of interests) {
    const created = i.createdAt > fresh ? daysAgo(between(3, 40)) : i.createdAt
    const age = Math.round((now.getTime() - created.getTime()) / DAY)
    await prisma.interest.update({ where: { id: i.id }, data: { createdAt: created, lastActivityAt: daysAgo(between(0, Math.min(age, 9))) } })
  }

  console.log(`\nAgency demo ready: ${AGENCY_DEMO_USERS[0].email} in "${AGENCY_DEMO_WORKSPACE_NAME}" (${workspaceId}).`)
  await prisma.$disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
