/**
 * Demo data for the developer experience, in the style of Algerian new-build
 * listings on Ouedkniss: F2-F5 apartments in Alger, Oran and Constantine, priced
 * in DZD, with buyers coming from Ouedkniss, Facebook, Instagram and walk-ins.
 *
 *   npx tsx scripts/demo/seed-developer.ts            create (refuses if it exists)
 *   npx tsx scripts/demo/seed-developer.ts --reset    delete the demo, then create
 *   npx tsx scripts/demo/seed-developer.ts --remove   delete the demo only
 *
 * Add `--email someone@example.com` to fill an account that already exists
 * instead, so its owner sees the developer workflow on their own login. That
 * mode switches the account to the developer experience and renames its first
 * workspace to match, but it never deletes the account or the workspace: on
 * --reset and --remove it clears only the records this seed writes, so whatever
 * was already in there stays. Colleague logins are derived from the address,
 * so clearing one person's demo cannot empty another's.
 *
 * By default it only touches the accounts in DEMO_USERS and the workspace they own. The
 * data goes through the real services (reserve, sign, certify, pay...) so every
 * side effect -- counters, commissions, calls for funds, tasks, stage moves --
 * is what the app itself would produce. Services stamp `now`, so the history is
 * spread over the last six months afterwards with direct updates.
 *
 * Email safety: demo users have notificationsEmail off, and buyers use addresses
 * at example.com, a domain reserved for examples that delivers to nobody. The
 * call reminders a buyer would already have had are recorded with their dates.
 */
import { loadEnv, DEMO_USERS, demoPassword, DEMO_WORKSPACE_NAME } from './env'

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
let seed = 20261008
const rand = () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296
  return seed / 4294967296
}
const pick = <T,>(items: readonly T[]): T => items[Math.floor(rand() * items.length)]
const between = (min: number, max: number) => min + Math.floor(rand() * (max - min + 1))
const roundTo = (n: number, step: number) => Math.round(n / step) * step

const FIRST_NAMES = [
  'Amine', 'Yasmine', 'Mohamed', 'Lina', 'Sofiane', 'Nesrine', 'Walid', 'Imane', 'Riad', 'Amel',
  'Bilal', 'Sarah', 'Hichem', 'Meriem', 'Nassim', 'Feriel', 'Djamel', 'Kenza', 'Rachid', 'Assia',
  'Farid', 'Lydia', 'Khaled', 'Chaima', 'Mourad', 'Selma', 'Toufik', 'Nadia', 'Abdelkader', 'Rym',
  'Islam', 'Houda', 'Samir', 'Wissem', 'Redouane', 'Inès', 'Yacine', 'Dounia',
]
const LAST_NAMES = [
  'Benali', 'Khelifi', 'Boudiaf', 'Mansouri', 'Saidi', 'Belkacem', 'Hamidi', 'Cherif', 'Brahimi', 'Ziani',
  'Larbi', 'Bouzidi', 'Kaci', 'Djebbar', 'Ouali', 'Mebarki', 'Rahmani', 'Benyahia', 'Amrani', 'Taleb',
  'Hadj Ahmed', 'Benmoussa', 'Lounis', 'Ferhat', 'Bensalem', 'Aouadi', 'Guerfi', 'Messaoudi',
]
const PHONE_PREFIXES = ['550', '551', '555', '560', '661', '662', '665', '670', '696', '697', '770', '771', '774', '779']

const ascii = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z]/g, '').toLowerCase()

/** Buyer sources, weighted like an Algerian developer's real mix: Ouedkniss first. */
const SOURCES: { source: string; campaign: string | null; weight: number }[] = [
  { source: 'portal', campaign: 'Ouedkniss – Annonces neuf', weight: 9 },
  { source: 'facebook', campaign: 'Facebook – Lancement Sidi Yahia', weight: 7 },
  { source: 'instagram', campaign: 'Instagram – Visite 3D', weight: 4 },
  { source: 'walk_in', campaign: null, weight: 4 },
  { source: 'referral', campaign: null, weight: 3 },
  { source: 'whatsapp', campaign: null, weight: 3 },
  { source: 'google_ads', campaign: 'Google – Appartement neuf Alger', weight: 2 },
  { source: 'event', campaign: 'Salon de l’Immobilier Alger (SAFEX)', weight: 2 },
]
const pickSource = () => {
  const total = SOURCES.reduce((n, s) => n + s.weight, 0)
  let r = rand() * total
  for (const s of SOURCES) {
    r -= s.weight
    if (r <= 0) return s
  }
  return SOURCES[0]
}

const PHOTOS = {
  building: [
    'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=1600&q=80',
    'https://images.unsplash.com/photo-1460317442991-0ec209397118?auto=format&fit=crop&w=1600&q=80',
    'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1600&q=80',
  ],
  interior: [
    'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=1600&q=80',
    'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=1600&q=80',
    'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1600&q=80',
  ],
}

async function main() {
  const args = new Set(process.argv.slice(2))
  const { prisma } = await import('../../src/lib/prisma')
  const bcrypt = (await import('bcryptjs')).default

  const demoEmails = DEMO_USERS.map((u) => u.email)

  /*
   * `--email <address>`: fill an account that already exists, so its owner can
   * walk the developer workflow on their own login. Without it the seed builds
   * its own isolated accounts, which stays the default because this database
   * is shared with real workspaces.
   *
   * A targeted run never deletes the account or its workspace: it clears only
   * the records this seed writes, so anything that was already there survives.
   */
  const argv = process.argv.slice(2)
  const emailAt = argv.indexOf('--email')
  const targetEmail =
    emailAt > -1 && argv[emailAt + 1] && !argv[emailAt + 1].startsWith('--')
      ? argv[emailAt + 1].trim().toLowerCase()
      : null
  if (emailAt > -1 && !targetEmail) throw new Error('--email needs an address, e.g. --email someone@example.com')
  /** Colleague accounts belong to the target, so clearing one demo cannot empty another. */
  const mateSuffix = targetEmail ? `.demo.${targetEmail.split('@')[0].replace(/[^a-z0-9]/g, '')}@example.com` : ''

  /** Everything this seed writes into a workspace. The rest of the workspace is left alone. */
  const wipeWorkspace = async (id: string) => {
    // Programs cascade to their units, milestones and calls for funds; leads to
    // their tasks and logged calls.
    await prisma.program.deleteMany({ where: { workspaceId: id } })
    await prisma.lead.deleteMany({ where: { pipeline: { workspaceId: id } } })
    await prisma.meeting.deleteMany({ where: { workspaceId: id } })
    await prisma.commission.deleteMany({ where: { workspaceId: id } })
    await prisma.marketingSpend.deleteMany({ where: { workspaceId: id } })
    await prisma.salesTemplate.deleteMany({ where: { workspaceId: id } })
    await prisma.alertRule.deleteMany({ where: { workspaceId: id } })
    await prisma.activity.deleteMany({ where: { workspaceId: id } })
  }

  // ── Remove ────────────────────────────────────────────────────────────────
  if (targetEmail) {
    const target = await prisma.user.findFirst({
      where: { email: { equals: targetEmail, mode: 'insensitive' } },
      select: { id: true },
    })
    if (!target) throw new Error(`No account for ${targetEmail}.`)
    const ws = await prisma.workspace.findFirst({
      where: { ownerId: target.id },
      orderBy: { createdAt: 'asc' },
      select: { id: true, name: true },
    })
    if (!ws) throw new Error(`${targetEmail} owns no workspace to fill.`)
    const already = await prisma.program.count({ where: { workspaceId: ws.id } })
    if (already > 0 && !args.has('--reset') && !args.has('--remove')) {
      console.log(`"${ws.name}" already holds ${already} projects. Use --reset to rebuild it, or --remove to clear it.`)
      return
    }
    if (args.has('--reset') || args.has('--remove')) {
      await wipeWorkspace(ws.id)
      await prisma.user.deleteMany({ where: { email: { endsWith: mateSuffix } } })
      console.log(`Cleared the demo data from "${ws.name}" (the workspace and its owner are untouched)`)
      if (args.has('--remove')) return
    }
  } else {
    const existing = await prisma.user.findMany({ where: { email: { in: demoEmails } }, select: { id: true, email: true } })
    if (existing.length > 0) {
      if (!args.has('--reset') && !args.has('--remove')) {
        console.log('The demo already exists. Run with --reset to recreate it, or --remove to delete it.')
        return
      }
      const ids = existing.map((u) => u.id)
      const workspaces = await prisma.workspace.findMany({ where: { ownerId: { in: ids } }, select: { id: true, name: true } })
      for (const ws of workspaces) {
        await prisma.workspace.delete({ where: { id: ws.id } })
        console.log(`Deleted demo workspace "${ws.name}"`)
      }
      await prisma.user.deleteMany({ where: { id: { in: ids }, email: { in: demoEmails } } })
      console.log(`Deleted ${ids.length} demo users`)
      if (args.has('--remove')) return
    } else if (args.has('--remove')) {
      console.log('No demo to remove.')
      return
    }
  }

  const { ensureDefaultPipelines, ensureDeveloperPipeline } = await import('../../src/lib/services/pipelines')
  const { createProgram, syncProgramCounters } = await import('../../src/lib/services/developer/programs')
  const { createLot, updateLot, setLotOption, reserveLot, cancelLotSale } = await import('../../src/lib/services/developer/lots')
  const { createLead } = await import('../../src/lib/services/leads')
  const { createTask, completeTask } = await import('../../src/lib/services/developer/tasks')
  const { logCall } = await import('../../src/lib/services/developer/calls')
  const { createSiteVisit, recordSiteVisitOutcome } = await import('../../src/lib/services/developer/site-visits')
  const { certifyMilestone } = await import('../../src/lib/services/developer/milestones')
  const { markCallForFundsPaid } = await import('../../src/lib/services/developer/calls-for-funds')
  const { createTMARequest, approveTMATechnical, acceptTMARequest, rejectTMARequest } = await import('../../src/lib/services/developer/tma')
  const { saveSpend } = await import('../../src/lib/services/developer/marketing-spend')
  const { saveTemplate, issueDocument } = await import('../../src/lib/services/developer/sales-documents')
  const { saveRule } = await import('../../src/lib/services/developer/alerts')
  const { markPaid } = await import('../../src/lib/services/commissions')
  const { syncLeadFollowUp, refreshLeadScore } = await import('../../src/lib/services/developer/lead-sync')
  const { DEVELOPER_SALES_PIPELINE } = await import('../../src/lib/crm/lifecycle')

  // ── Accounts and workspace ────────────────────────────────────────────────
  const password = await bcrypt.hash(demoPassword(), 12)
  const DESCRIPTION = 'Promoteur immobilier – Alger, Oran, Constantine (données de démonstration)'
  let ownerId: string
  let workspaceId: string
  let agents: string[]

  if (targetEmail) {
    // The account keeps its own login (Google or password) and its id; only the
    // fields the developer experience reads are changed.
    const target = await prisma.user.findFirstOrThrow({
      where: { email: { equals: targetEmail, mode: 'insensitive' } },
      select: { id: true },
    })
    ownerId = target.id
    await prisma.user.update({ where: { id: ownerId }, data: { businessType: 'DEVELOPER' } })

    const ws = await prisma.workspace.findFirstOrThrow({
      where: { ownerId },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    })
    workspaceId = ws.id
    // Prices are in dinars, so the workspace currency has to match or every
    // figure on every page reads as dollars.
    await prisma.workspace.update({
      where: { id: workspaceId },
      data: { name: 'Promotion Nour El Bina', description: DESCRIPTION, icon: '🏗️', currency: 'DZD' },
    })

    // Two colleagues, so assignment, the team page and the activity feed show
    // more than one name. Their addresses are derived from the target, so
    // clearing one person's demo never touches another's.
    const mates = [
      { email: `samira${mateSuffix}`, name: 'Samira Bouzid', role: 'admin' },
      { email: `yacine${mateSuffix}`, name: 'Yacine Meziane', role: 'member' },
    ]
    const mateIds: string[] = []
    for (const m of mates) {
      const user = await prisma.user.upsert({
        where: { email: m.email },
        update: {},
        create: {
          email: m.email,
          name: m.name,
          password,
          emailVerified: daysAgo(200),
          businessType: 'DEVELOPER',
          notificationsEmail: false,
          createdAt: daysAgo(200),
        },
      })
      await prisma.workspaceMember.upsert({
        where: { workspaceId_userId: { workspaceId, userId: user.id } },
        update: { role: m.role },
        create: { workspaceId, userId: user.id, role: m.role },
      })
      mateIds.push(user.id)
    }
    agents = [ownerId, ...mateIds]
  } else {
    const users: Record<string, string> = {}
    for (const u of DEMO_USERS) {
      const user = await prisma.user.create({
        data: {
          email: u.email,
          name: u.name,
          password,
          emailVerified: daysAgo(200),
          businessType: 'DEVELOPER',
          notificationsEmail: false,
          createdAt: daysAgo(200),
        },
      })
      users[u.key] = user.id
    }
    ownerId = users.owner
    agents = [users.owner, users.samira, users.yacine]

    const workspace = await prisma.workspace.create({
      data: {
        name: DEMO_WORKSPACE_NAME,
        description: DESCRIPTION,
        icon: '🏗️',
        currency: 'DZD',
        ownerId,
        createdAt: daysAgo(200),
      },
    })
    workspaceId = workspace.id
    for (const u of DEMO_USERS.filter((u) => u.role !== 'owner')) {
      await prisma.workspaceMember.create({ data: { workspaceId, userId: users[u.key], role: u.role } })
    }
  }
  await ensureDefaultPipelines(workspaceId)
  await ensureDeveloperPipeline(workspaceId)
  const pipeline = await prisma.pipeline.findFirstOrThrow({
    where: { workspaceId, name: DEVELOPER_SALES_PIPELINE.name },
    select: { id: true, workspaceId: true, stages: true },
  })

  const ctx = { workspaceId, userId: ownerId }
  const as = (userId: string) => ({ workspaceId, userId })

  // ── Projects ──────────────────────────────────────────────────────────────
  type ProjectSpec = {
    reference: string; name: string; city: string; address: string; status: string
    launch: Date; delivery: Date; target: number; revenue: number; pricePerM2: number
    buildings: string[]; floors: number; perFloor: number; description: string; architect: string; bank: string; notary: string
  }
  const PROJECTS: ProjectSpec[] = [
    {
      reference: 'ALG-SY', name: 'Résidence Les Jardins de Sidi Yahia', city: 'Hydra, Alger', address: 'Chemin Sidi Yahia, Hydra',
      status: 'commercialization', launch: daysAgo(190), delivery: new Date('2028-06-30'), target: 20, revenue: 700_000_000,
      pricePerM2: 235_000, buildings: ['Bloc A', 'Bloc B'], floors: 6, perFloor: 2,
      description: 'Résidence haut standing de 2 blocs R+6 : F2 à F5, ascenseur, parking sous-sol, gardiennage 24h/24, vue dégagée sur la baie d’Alger.',
      architect: 'Atelier Bensaci Architectes', bank: 'CPA – Agence Hydra', notary: 'Maître Leila Boukhalfa',
    },
    {
      reference: 'ORN-BED', name: 'Les Terrasses de Bir El Djir', city: 'Bir El Djir, Oran', address: 'Boulevard de l’ANP, Bir El Djir',
      status: 'construction', launch: daysAgo(380), delivery: new Date('2027-09-30'), target: 16, revenue: 280_000_000,
      pricePerM2: 155_000, buildings: ['Bloc unique'], floors: 5, perFloor: 3,
      description: 'Appartements F3 et F4 avec terrasses, à 5 minutes du front de mer. Promotion immobilière en VSP (vente sur plans), livraison prévue fin 2027.',
      architect: 'Cabinet Mekki & Associés', bank: 'BNA – Agence Oran Est', notary: 'Maître Sid Ahmed Belhadj',
    },
    {
      reference: 'CST-ELF', name: 'Résidence El Feth', city: 'Ali Mendjeli, Constantine', address: 'UV 14, Ali Mendjeli',
      status: 'study', launch: new Date('2027-01-15'), delivery: new Date('2029-03-31'), target: 10, revenue: 160_000_000,
      pricePerM2: 115_000, buildings: ['Bloc 1'], floors: 3, perFloor: 3,
      description: 'Projet en étude : petits immeubles R+3, F3 et F4 familiaux proches du tramway. Pré-réservations ouvertes.',
      architect: 'Bureau d’études Zerrouki', bank: 'CNEP – Agence Constantine', notary: 'Maître Rym Kadri',
    },
  ]

  const TYPOLOGIES = [
    { t: 'T2', f: 'F2', min: 68, max: 82, bedrooms: 1 },
    { t: 'T3', f: 'F3', min: 95, max: 118, bedrooms: 2 },
    { t: 'T4', f: 'F4', min: 125, max: 145, bedrooms: 3 },
    { t: 'T5', f: 'F5', min: 155, max: 175, bedrooms: 4 },
  ]
  const ORIENTATIONS = ['Nord', 'Sud', 'Est', 'Ouest', 'Sud-Est', 'Nord-Ouest']

  const programs: { spec: ProjectSpec; id: string; lots: { id: string; lotNumber: string; typology: string; totalPrice: number; buildingId: string | null }[] }[] = []
  for (const spec of PROJECTS) {
    const program = await createProgram(ctx, {
      reference: spec.reference,
      name: spec.name,
      commercialName: spec.name,
      description: spec.description,
      projectType: 'residential',
      developerName: 'SARL El Bina Promotion',
      addressLine: spec.address,
      city: spec.city,
      countryCode: 'DZ',
      status: spec.status,
      permitNumber: `PC-${spec.reference}-2025-${between(100, 999)}`,
      architectName: spec.architect,
      gfaBank: spec.bank,
      notaryName: spec.notary,
      launchDate: spec.launch,
      targetDeliveryDate: spec.delivery,
      salesTargetUnits: spec.target,
      revenueTarget: spec.revenue,
      commissionPercent: 1.5,
    })
    await prisma.program.update({ where: { id: program.id }, data: { createdAt: spec.launch < now ? spec.launch : daysAgo(30) } })

    const entry = { spec, id: program.id, lots: [] as (typeof programs)[number]['lots'] }
    for (const [b, buildingName] of spec.buildings.entries()) {
      const building = await prisma.building.create({ data: { programId: program.id, name: buildingName } })
      for (let floor = 0; floor <= spec.floors; floor++) {
        for (let n = 1; n <= spec.perFloor; n++) {
          // Small flats low down, the big ones and the penthouse floor on top.
          const typ = floor === spec.floors ? TYPOLOGIES[3] : TYPOLOGIES[Math.min(3, (n + floor + b) % 3 + (floor > spec.floors / 2 ? 1 : 0))]
          const surface = between(typ.min, typ.max)
          const ttc = roundTo(surface * spec.pricePerM2 * (1 + floor * 0.012), 100_000)
          const lotNumber = `${spec.buildings.length > 1 ? buildingName.slice(-1) : 'L'}${floor}${String(n).padStart(2, '0')}`
          const lot = await createLot(ctx, {
            programId: program.id,
            buildingId: building.id,
            lotNumber,
            type: 'apartment',
            typology: typ.t,
            floor,
            orientation: pick(ORIENTATIONS),
            bedrooms: typ.bedrooms,
            surfaceArea: surface,
            balconyArea: floor > 0 ? between(6, 14) : 0,
            terraceArea: floor === spec.floors ? between(25, 60) : 0,
            gardenArea: floor === 0 ? between(20, 45) : 0,
            basePrice: roundTo(ttc / 1.19, 1000),
            taxRate: 19,
            customFields: { appellation: typ.f, etage: floor === 0 ? 'RDC' : `${floor}e étage` },
          })
          entry.lots.push({ id: lot.id, lotNumber, typology: typ.t, totalPrice: lot.totalPrice, buildingId: building.id })
        }
      }
      // Underground parking spaces sold with the flats.
      if (spec.status !== 'study') {
        for (let p = 1; p <= 3; p++) {
          await createLot(ctx, {
            programId: program.id, buildingId: building.id, lotNumber: `P${b + 1}-${p}`, type: 'parking',
            floor: -1, surfaceArea: 13, basePrice: roundTo(1_500_000 / 1.19, 1000), taxRate: 19,
          })
        }
      }
    }
    programs.push(entry)
    console.log(`Project ${spec.reference}: ${entry.lots.length} apartments`)
  }
  const [sidiYahia, birElDjir, elFeth] = programs

  // Photos and plans, as links so nothing has to be uploaded.
  for (const [i, p] of programs.entries()) {
    const media = [
      { kind: 'photo', title: 'Façade principale', url: PHOTOS.building[i % 3], isCover: true },
      { kind: '3d_render', title: 'Vue 3D de la résidence', url: PHOTOS.building[(i + 1) % 3], isCover: false },
      { kind: 'photo', title: 'Séjour – appartement témoin F3', url: PHOTOS.interior[i % 3], isCover: false },
      { kind: 'photo', title: 'Cuisine équipée', url: PHOTOS.interior[(i + 1) % 3], isCover: false },
    ]
    for (const [position, m] of media.entries()) {
      await prisma.programMedia.create({
        data: {
          programId: p.id, workspaceId, kind: m.kind, title: m.title, externalUrl: m.url, fileName: `${m.title}.jpg`,
          fileType: 'image/jpeg', position, isCover: m.isCover, uploadedById: ownerId,
        },
      })
    }
  }

  // ── Buyers ────────────────────────────────────────────────────────────────
  const usedNames = new Set<string>()
  const leadIds: string[] = []
  const leadInfo = new Map<string, { name: string; createdAt: Date; ownerId: string }>()

  async function makeBuyer(stage: string, opts: { programId?: string; typology?: string; createdDaysAgo: number; ownerId?: string }) {
    let first = '', last = ''
    do { first = pick(FIRST_NAMES); last = pick(LAST_NAMES) } while (usedNames.has(first + last))
    usedNames.add(first + last)
    const source = pickSource()
    const project = opts.programId ? programs.find((p) => p.id === opts.programId)! : pick(programs.slice(0, 2))
    const typ = opts.typology ?? pick(['T2', 'T3', 'T3', 'T4', 'T4', 'T5'])
    const typSpec = TYPOLOGIES.find((t) => t.t === typ)!
    const centre = ((typSpec.min + typSpec.max) / 2) * project.spec.pricePerM2
    const owner = opts.ownerId ?? pick(agents)
    const lead = await createLead(pipeline, {
      firstName: first,
      lastName: last,
      email: `${ascii(first)}.${ascii(last)}@example.com`,
      phone: `+213 ${pick(PHONE_PREFIXES)} ${between(10, 99)} ${between(10, 99)} ${between(10, 99)}`,
      stage,
      source: source.source,
      campaign: source.campaign,
      ownerId: owner,
      interestedProgramId: project.id,
      interestedTypology: typ,
      budgetMin: roundTo(centre * 0.85, 500_000),
      budgetMax: roundTo(centre * 1.1, 500_000),
      preferredLocation: project.spec.city,
      value: roundTo(centre, 100_000),
      notes: `Recherche un ${typSpec.f} ${pick(['avec vue', 'à un étage élevé', 'proche des écoles', 'avec parking', 'au calme'])}. ${pick([
        'Financement CNEP en cours.', 'Paiement comptant possible.', 'Crédit immobilier BNA à 1 %.', 'Vend un bien pour financer.', 'Émigré, achat à distance.',
      ])}`,
    })
    const createdAt = daysAgo(opts.createdDaysAgo, between(9, 18))
    leadIds.push(lead.id)
    leadInfo.set(lead.id, { name: `${first} ${last}`, createdAt, ownerId: owner })
    return lead.id
  }

  // Buyers still in the funnel, newest at the top.
  const funnel: [string, number, number, number][] = [
    // stage, count, oldest (days ago), newest
    ['New', 6, 3, 0],
    ['Contacted', 6, 12, 2],
    ['Qualified', 5, 30, 8],
    ['Site visit', 5, 45, 10],
    ['Negotiation', 4, 60, 15],
    ['Lost', 3, 120, 40],
  ]
  const byStage: Record<string, string[]> = {}
  for (const [stage, count, oldest, newest] of funnel) {
    byStage[stage] = []
    for (let i = 0; i < count; i++) {
      byStage[stage].push(await makeBuyer(stage, { createdDaysAgo: between(newest, oldest) }))
    }
  }

  // ── Sales ─────────────────────────────────────────────────────────────────
  type Sale = { program: (typeof programs)[number]; lotIndex: number; outcome: 'optioned' | 'reserved' | 'contract_signed' | 'deed_signed' | 'cancelled'; reservedDaysAgo: number; signedDaysAgo?: number; deedDaysAgo?: number }
  const SALES: Sale[] = [
    // Oran: under construction, most of it sold over the last year.
    { program: birElDjir, lotIndex: 0, outcome: 'deed_signed', reservedDaysAgo: 175, signedDaysAgo: 160, deedDaysAgo: 120 },
    { program: birElDjir, lotIndex: 2, outcome: 'deed_signed', reservedDaysAgo: 168, signedDaysAgo: 150, deedDaysAgo: 100 },
    { program: birElDjir, lotIndex: 4, outcome: 'deed_signed', reservedDaysAgo: 150, signedDaysAgo: 140, deedDaysAgo: 75 },
    { program: birElDjir, lotIndex: 5, outcome: 'contract_signed', reservedDaysAgo: 140, signedDaysAgo: 120 },
    { program: birElDjir, lotIndex: 7, outcome: 'contract_signed', reservedDaysAgo: 115, signedDaysAgo: 95 },
    { program: birElDjir, lotIndex: 8, outcome: 'contract_signed', reservedDaysAgo: 90, signedDaysAgo: 70 },
    { program: birElDjir, lotIndex: 10, outcome: 'contract_signed', reservedDaysAgo: 70, signedDaysAgo: 48 },
    { program: birElDjir, lotIndex: 12, outcome: 'contract_signed', reservedDaysAgo: 50, signedDaysAgo: 25 },
    { program: birElDjir, lotIndex: 13, outcome: 'reserved', reservedDaysAgo: 18 },
    { program: birElDjir, lotIndex: 15, outcome: 'reserved', reservedDaysAgo: 9 },
    { program: birElDjir, lotIndex: 9, outcome: 'cancelled', reservedDaysAgo: 80 },
    // Alger: on sale since the spring.
    { program: sidiYahia, lotIndex: 1, outcome: 'contract_signed', reservedDaysAgo: 110, signedDaysAgo: 85 },
    { program: sidiYahia, lotIndex: 3, outcome: 'contract_signed', reservedDaysAgo: 75, signedDaysAgo: 52 },
    { program: sidiYahia, lotIndex: 6, outcome: 'contract_signed', reservedDaysAgo: 40, signedDaysAgo: 20 },
    { program: sidiYahia, lotIndex: 15, outcome: 'contract_signed', reservedDaysAgo: 30, signedDaysAgo: 6 },
    { program: sidiYahia, lotIndex: 10, outcome: 'reserved', reservedDaysAgo: 14 },
    { program: sidiYahia, lotIndex: 20, outcome: 'reserved', reservedDaysAgo: 5 },
    { program: sidiYahia, lotIndex: 22, outcome: 'reserved', reservedDaysAgo: 2 },
    { program: sidiYahia, lotIndex: 8, outcome: 'optioned', reservedDaysAgo: 1 },
    { program: sidiYahia, lotIndex: 17, outcome: 'optioned', reservedDaysAgo: 0 },
  ]

  const sold: { lotId: string; buyerId: string; agentId: string; program: (typeof programs)[number]; sale: Sale }[] = []
  for (const sale of SALES) {
    const lot = sale.program.lots[sale.lotIndex]
    const agentId = pick(agents)
    const buyerId = await makeBuyer('Negotiation', {
      programId: sale.program.id, typology: lot.typology, createdDaysAgo: sale.reservedDaysAgo + between(10, 40), ownerId: agentId,
    })
    const actx = as(agentId)
    if (sale.outcome === 'optioned') {
      await setLotOption(actx, lot.id, { leadId: buyerId, durationHours: 72 })
      continue
    }
    await reserveLot(actx, lot.id, {
      buyerLeadId: buyerId, salesAgentId: agentId,
      reservationFee: roundTo(lot.totalPrice * 0.1, 10_000),
      // The deposit arrived by transfer on the day of the reservation, through the ledger.
      depositPayment: { method: 'bank_transfer', paidAt: daysAgo(sale.reservedDaysAgo), clientRequestId: `seed-deposit-${lot.id}` },
    })
    if (sale.outcome === 'contract_signed' || sale.outcome === 'deed_signed') {
      await updateLot(actx, lot.id, { status: 'contract_signed' })
    }
    if (sale.outcome === 'deed_signed') {
      await updateLot(actx, lot.id, { status: 'deed_signed' })
    }
    if (sale.outcome === 'cancelled') {
      await cancelLotSale({ ...ctx, canModerate: true }, lot.id, { reason: 'Refus du crédit immobilier par la banque', refundAmount: roundTo(lot.totalPrice * 0.1, 10_000) })
    }
    // The dates the services stamped as "now", moved back to when it happened.
    await prisma.developmentLot.update({
      where: { id: lot.id },
      data: {
        reservedAt: sale.outcome === 'cancelled' ? null : daysAgo(sale.reservedDaysAgo),
        contractSignedAt: sale.signedDaysAgo !== undefined ? daysAgo(sale.signedDaysAgo) : undefined,
        notaryDeedSignedAt: sale.deedDaysAgo !== undefined ? daysAgo(sale.deedDaysAgo) : undefined,
        notaryDeedScheduledAt: sale.outcome === 'contract_signed' ? daysAhead(between(20, 90)) : undefined,
      },
    })
    if (sale.outcome === 'cancelled') {
      await prisma.lotCancellation.updateMany({ where: { lotId: lot.id }, data: { cancelledAt: daysAgo(sale.reservedDaysAgo - 21) } })
      await prisma.lead.update({ where: { id: buyerId }, data: { stage: 'Lost' } })
    }
    sold.push({ lotId: lot.id, buyerId, agentId, program: sale.program, sale })
  }
  // A unit and its parking: the first Oran deed includes a parking space.
  const oranParking = await prisma.developmentLot.findFirst({ where: { programId: birElDjir.id, type: 'parking' } })
  if (oranParking) {
    const first = sold[0]
    await reserveLot(as(first.agentId), oranParking.id, { buyerLeadId: first.buyerId, salesAgentId: first.agentId })
    await updateLot(as(first.agentId), oranParking.id, { status: 'contract_signed', parentLotId: first.lotId })
    await prisma.developmentLot.update({ where: { id: oranParking.id }, data: { reservedAt: daysAgo(170), contractSignedAt: daysAgo(160) } })
  }

  // Commission dates follow the sale dates; the two oldest realized ones are paid.
  for (const s of sold) {
    if (!s.sale.signedDaysAgo) continue
    await prisma.commission.updateMany({
      where: { lotId: s.lotId },
      data: {
        createdAt: daysAgo(s.sale.signedDaysAgo),
        realizedAt: s.sale.deedDaysAgo !== undefined ? daysAgo(s.sale.deedDaysAgo) : undefined,
      },
    })
  }
  const realized = await prisma.commission.findMany({ where: { workspaceId, status: 'realized' }, orderBy: { realizedAt: 'asc' }, take: 2 })
  for (const c of realized) {
    await markPaid(c.id, { workspaceId, userId: ownerId, canModerate: true } as any)
    await prisma.commission.update({ where: { id: c.id }, data: { paidAt: daysAgo(30) } })
    await prisma.commissionSplit.updateMany({ where: { commissionId: c.id }, data: { paidAt: daysAgo(30) } })
  }

  // ── Construction and calls for funds ───────────────────────────────────────
  // Oran: foundations (15 %) and the ground-floor slab (35 %) are certified.
  // Alger: foundations just certified, so its first calls are still open.
  const milestones = async (programId: string) =>
    prisma.constructionMilestone.findMany({ where: { programId }, orderBy: { order: 'asc' } })
  const oranMilestones = await milestones(birElDjir.id)
  const algerMilestones = await milestones(sidiYahia.id)

  const REMINDER_STEPS: [string, number][] = [['before7', -7], ['due', 0], ['late3', 3], ['late7', 7], ['late14', 14]]
  const certify = async (milestone: { id: string }, certifiedDaysAgo: number, issuedDaysAgo: number, dueDaysAgo: number) => {
    await certifyMilestone(ctx, milestone.id, { architectCertificateDoc: 'Attestation de l’architecte (PV de constat)' })
    await prisma.constructionMilestone.update({ where: { id: milestone.id }, data: { certifiedAt: daysAgo(certifiedDaysAgo) } })
    const calls = await prisma.callForFunds.findMany({ where: { milestoneId: milestone.id } })
    for (const call of calls) {
      await prisma.callForFunds.update({ where: { id: call.id }, data: { issuedAt: daysAgo(issuedDaysAgo), dueAt: daysAgo(dueDaysAgo), createdAt: daysAgo(issuedDaysAgo) } })
      if (call.invoiceId) {
        await prisma.invoice.update({ where: { id: call.invoiceId }, data: { issueDate: daysAgo(issuedDaysAgo), dueDate: daysAgo(dueDaysAgo), createdAt: daysAgo(issuedDaysAgo) } })
      }
      // The reminders that would already have gone out, on the day they would have.
      for (const [step, offset] of REMINDER_STEPS) {
        const sentAt = new Date(daysAgo(dueDaysAgo).getTime() + offset * DAY)
        if (sentAt < now) await prisma.callReminder.create({ data: { callId: call.id, step, sentAt } }).catch(() => {})
      }
    }
    return calls
  }

  // A paid call stops its reminders: none is dated after the payment.
  const payCall = async (callId: string, paidAt: Date, method: string) => {
    await markCallForFundsPaid(ctx, callId, { paidAt, method, reference: `VIR-${between(100000, 999999)}` })
    await prisma.callReminder.deleteMany({ where: { callId, sentAt: { gt: paidAt } } })
  }
  const foundationsOran = await certify(oranMilestones[0], 140, 140, 110)
  for (const call of foundationsOran) {
    await payCall(call.id, daysAgo(between(105, 125)), 'bank_transfer')
  }
  const slabOran = await certify(oranMilestones[1], 45, 45, 15)
  for (const [i, call] of slabOran.entries()) {
    if (i % 3 === 2) {
      // Late: past due and unpaid.
      await prisma.callForFunds.update({ where: { id: call.id }, data: { status: 'overdue' } })
      if (call.invoiceId) await prisma.invoice.update({ where: { id: call.invoiceId }, data: { status: 'overdue' } })
    } else {
      await payCall(call.id, daysAgo(between(16, 30)), pick(['bank_transfer', 'check']))
    }
  }
  await certify(algerMilestones[0], 8, 8, -22)

  // ── Buyer modification requests (TMA) ─────────────────────────────────────
  const oranSold = sold.filter((s) => s.program === birElDjir && s.sale.outcome !== 'cancelled' && s.sale.outcome !== 'reserved')
  const algerSold = sold.filter((s) => s.program === sidiYahia && s.sale.outcome === 'contract_signed')
  const tma = async (s: (typeof sold)[number], data: { category: string; title: string; description: string; costEstimate?: number; priceQuote?: number }) =>
    createTMARequest(ctx, { lotId: s.lotId, buyerLeadId: s.buyerId, ...data })
  const t1 = await tma(oranSold[0], { category: 'partitions', title: 'Suppression de la cloison cuisine-séjour', description: 'Le client souhaite une cuisine ouverte (type américaine) sur le séjour.', costEstimate: 180_000 })
  await approveTMATechnical(ctx, t1.id, { techApproverNote: 'Cloison non porteuse, faisable avant les enduits.', costEstimate: 180_000, priceQuote: 260_000 })
  await acceptTMARequest(ctx, t1.id, { signedAddendumDoc: 'Avenant TMA signé' })
  const t2 = await tma(oranSold[1], { category: 'electrical', title: 'Prises supplémentaires et pré-installation climatisation', description: '4 prises en plus dans le séjour, attentes climatisation dans les chambres.', priceQuote: 95_000 })
  void t2
  const t3 = await tma(oranSold[2], { category: 'finishes', title: 'Carrelage grand format en marbre', description: 'Remplacer le carrelage standard 60×60 par du marbre de Skikda dans le séjour.', costEstimate: 650_000 })
  await rejectTMARequest(ctx, t3.id, 'Hors délai : le carrelage du lot est déjà commandé.')
  await tma(oranSold[3], { category: 'plumbing', title: 'Déplacement de la salle d’eau', description: 'Déplacer la douche à l’italienne côté fenêtre.' })
  if (algerSold[0]) {
    const t5 = await tma(algerSold[0], { category: 'finishes', title: 'Parquet dans les chambres', description: 'Parquet chêne massif à la place du carrelage dans les 3 chambres.', costEstimate: 420_000 })
    await approveTMATechnical(ctx, t5.id, { techApproverNote: 'Faisable, délai fournisseur 6 semaines.', costEstimate: 420_000 })
  }

  // ── Site visits ───────────────────────────────────────────────────────────
  // Done visits, with what the buyer thought.
  const visitOutcomes = ['interested', 'needs_follow_up', 'interested', 'not_interested', 'needs_follow_up']
  for (const [i, leadId] of byStage['Site visit'].entries()) {
    const info = leadInfo.get(leadId)!
    const lead = await prisma.lead.findUniqueOrThrow({ where: { id: leadId }, select: { interestedProgramId: true } })
    const visit = await createSiteVisit(as(info.ownerId), {
      leadId, programId: lead.interestedProgramId!, startTime: daysAgo(between(3, 12), between(9, 16)).toISOString(),
      duration: 60, hostId: info.ownerId, notes: 'Visite de l’appartement témoin et du chantier.',
    })
    if (i === 4) {
      await recordSiteVisitOutcome(as(info.ownerId), visit.id, { attended: false })
    } else {
      await recordSiteVisitOutcome(as(info.ownerId), visit.id, {
        attended: true, outcome: visitOutcomes[i], comments: pick(['A aimé la vue et les finitions.', 'Trouve le prix un peu élevé.', 'Veut revenir avec son épouse.', 'Hésite entre F3 et F4.']),
      })
    }
  }
  // Coming up this week and next.
  for (const [i, leadId] of byStage['Qualified'].slice(0, 4).entries()) {
    const info = leadInfo.get(leadId)!
    const lead = await prisma.lead.findUniqueOrThrow({ where: { id: leadId }, select: { interestedProgramId: true } })
    await createSiteVisit(as(info.ownerId), {
      leadId, programId: lead.interestedProgramId!, startTime: daysAhead(i * 2 + 1, 10 + i).toISOString(), duration: 45, hostId: info.ownerId,
      notes: 'Visite du showroom puis du chantier.',
    })
  }

  // ── Calls and follow-ups ──────────────────────────────────────────────────
  const callNotes = [
    'Intéressé par un F3 au 4e étage, demande le plan.', 'Rappeler après le versement de la prime.', 'Messagerie, pas de réponse.',
    'A comparé avec un projet à Draria, notre prix est cohérent.', 'Attend l’accord de crédit CNEP.', 'Souhaite une remise pour paiement comptant.',
  ]
  const activeBuyers = [...byStage['Contacted'], ...byStage['Qualified'], ...byStage['Site visit'], ...byStage['Negotiation']]
  for (const leadId of activeBuyers) {
    const info = leadInfo.get(leadId)!
    for (let c = 0; c < between(1, 3); c++) {
      const answered = rand() > 0.3
      const { activity } = await logCall(as(info.ownerId), leadId, {
        direction: rand() > 0.75 ? 'inbound' : 'outbound', answered, durationMin: answered ? between(2, 18) : 0, note: pick(callNotes),
      })
      if (activity) await prisma.activity.update({ where: { id: activity.id }, data: { createdAt: daysAgo(between(0, 20), between(9, 18)) } })
    }
  }
  const TASKS = [
    { type: 'send_price_list', title: 'Envoyer la grille de prix et le plan du F3' },
    { type: 'call', title: 'Rappeler pour fixer une visite' },
    { type: 'follow_up', title: 'Relancer après la visite du chantier' },
    { type: 'send_floor_plan', title: 'Envoyer les plans du F4 au 5e étage' },
    { type: 'payment_reminder', title: 'Rappeler le versement de la prime de réservation' },
    { type: 'contract', title: 'Préparer le contrat VSP chez le notaire' },
  ]
  const dueOffsets = [-4, -2, -1, 0, 0, 1, 2, 3, 5, 7]
  for (const [i, leadId] of [...byStage['New'], ...activeBuyers].entries()) {
    const info = leadInfo.get(leadId)!
    const task = pick(TASKS)
    const due = daysAhead(dueOffsets[i % dueOffsets.length], between(9, 17))
    const created = await createTask(as(info.ownerId), { leadId, type: task.type, title: task.title, dueAt: due, assigneeId: info.ownerId })
    if (i % 5 === 4) await completeTask(as(info.ownerId), created.id)
  }

  // ── Documents, templates, spend, alerts ───────────────────────────────────
  await saveTemplate(ctx, {
    kind: 'reservation',
    name: 'Contrat de réservation VSP',
    body: [
      'CONTRAT DE RÉSERVATION N° {{document_number}}',
      '',
      'Entre {{developer}}, promoteur immobilier, et {{buyer_name}} (tél. {{buyer_phone}}).',
      'Objet : réservation du logement {{unit}} ({{typology}}, {{surface}} m², étage {{floor}}) du projet {{project}}, {{project_address}}.',
      'Prix de vente : {{final_price}} TTC (TVA {{vat_rate}}). Prime de réservation : {{reservation_fee}}.',
      'Le présent contrat est suivi d’un contrat de vente sur plans (VSP) établi devant notaire.',
      'Fait le {{date}}. Conseiller commercial : {{agent}}.',
    ].join('\n'),
  })
  await saveTemplate(ctx, {
    kind: 'payment_reminder',
    name: 'Rappel d’appel de fonds',
    subject: 'Appel de fonds – {{project}} – {{unit}}',
    body: 'Bonjour {{buyer_name}},\n\nNous vous rappelons que l’appel de fonds « {{milestone}} » d’un montant de {{amount_due}} arrive à échéance le {{due_date}}.\nVous pouvez suivre votre dossier ici : {{portal_link}}\n\nCordialement,\n{{developer}}',
  })
  for (const s of sold.filter((s) => s.sale.outcome === 'reserved').slice(0, 2)) await issueDocument(as(s.agentId), s.lotId, 'reservation')
  for (const s of sold.filter((s) => s.sale.outcome === 'contract_signed').slice(0, 2)) await issueDocument(as(s.agentId), s.lotId, 'contract')

  const SPEND = [
    { source: 'portal', campaign: 'Ouedkniss – Annonces neuf', base: 60_000 },
    { source: 'facebook', campaign: 'Facebook – Lancement Sidi Yahia', base: 95_000 },
    { source: 'instagram', campaign: 'Instagram – Visite 3D', base: 40_000 },
    { source: 'google_ads', campaign: 'Google – Appartement neuf Alger', base: 35_000 },
  ]
  for (let m = 5; m >= 0; m--) {
    const month = new Date(now.getFullYear(), now.getMonth() - m, 1)
    const key = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}`
    for (const s of SPEND) await saveSpend(ctx, { source: s.source, campaign: s.campaign, month: key, amount: roundTo(s.base * (0.8 + rand() * 0.5), 1000) })
  }
  await saveSpend(ctx, { source: 'event', campaign: 'Salon de l’Immobilier Alger (SAFEX)', month: `${now.getFullYear()}-${String(now.getMonth() || 12).padStart(2, '0')}`, amount: 350_000 })

  await saveRule({ ...ctx, canModerate: true }, { type: 'lead_no_response', enabled: true, params: { minutes: 30 } })
  await saveRule({ ...ctx, canModerate: true }, { type: 'low_inventory', enabled: true, params: { minAvailablePercent: 15 } })

  // ── History ───────────────────────────────────────────────────────────────
  for (const [leadId, info] of leadInfo) {
    await prisma.lead.update({ where: { id: leadId }, data: { createdAt: info.createdAt } })
    await prisma.activity.updateMany({ where: { leadId, type: { in: ['lead_stage_changed', 'task_created'] }, createdAt: { gt: info.createdAt } }, data: { createdAt: info.createdAt } })
  }
  // Modification requests came in over the last two months, oldest first.
  const requests = await prisma.tMARequest.findMany({ where: { workspaceId }, orderBy: { createdAt: 'asc' } })
  for (const [i, r] of requests.entries()) {
    const at = daysAgo(60 - i * 11)
    await prisma.tMARequest.update({
      where: { id: r.id },
      data: { createdAt: at, techApprovedAt: r.techApprovedAt ? daysAgo(55 - i * 11) : undefined, signedAt: r.signedAt ? daysAgo(50 - i * 11) : undefined },
    })
  }
  for (const p of programs) await syncProgramCounters(p.id)
  for (const leadId of leadIds) {
    await syncLeadFollowUp(leadId)
    await refreshLeadScore(leadId)
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  const [lots, leads, tasks, visits, calls, commissions, tmas] = await Promise.all([
    prisma.developmentLot.groupBy({ by: ['status'], where: { workspaceId }, _count: true }),
    prisma.lead.count({ where: { pipeline: { workspaceId } } }),
    prisma.leadTask.count({ where: { workspaceId, completedAt: null } }),
    prisma.meeting.count({ where: { workspaceId, programId: { not: null } } }),
    prisma.callForFunds.groupBy({ by: ['status'], where: { workspaceId }, _count: true }),
    prisma.commission.groupBy({ by: ['status'], where: { workspaceId }, _count: true }),
    prisma.tMARequest.count({ where: { workspaceId } }),
  ])
  const workspaceName = (await prisma.workspace.findUniqueOrThrow({ where: { id: workspaceId }, select: { name: true } })).name
  console.log('\nDemo ready.')
  console.log(`  Workspace: ${workspaceName} (${workspaceId})`)
  console.log(`  Units by status: ${lots.map((l) => `${l.status} ${l._count}`).join(', ')}`)
  console.log(`  Buyers: ${leads} · open follow-ups: ${tasks} · site visits: ${visits} · modification requests: ${tmas}`)
  console.log(`  Calls for funds: ${calls.map((c) => `${c.status} ${c._count}`).join(', ')}`)
  console.log(`  Commissions: ${commissions.map((c) => `${c.status} ${c._count}`).join(', ')}`)
  if (targetEmail) {
    // The account signs in however it already did; only the colleagues are new.
    console.log(`\n  Log in: ${targetEmail} (its own existing password or Google sign-in)`)
    console.log(`  Colleagues: samira${mateSuffix}, yacine${mateSuffix} / ${demoPassword()}`)
  } else {
    console.log(`\n  Log in: ${DEMO_USERS[0].email} / ${demoPassword()}`)
    console.log(`  Salespeople: ${DEMO_USERS.slice(1).map((u) => u.email).join(', ')} (same password)`)
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
