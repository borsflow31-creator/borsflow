/**
 * What every page of the app is for, as the assistant explains it.
 *
 * The words come from the app's own guides -- the one-line descriptions under
 * each sidebar item (`developerGuide.desc.*`) and the numbered "How this page
 * works" steps (`developerGuide.pages.*`) -- read from the English catalog. So
 * the assistant can only ever describe a page the way the page describes itself,
 * and rewording a guide reaches the assistant with it. Only what the catalog has
 * no place for lives here: the route, who the page is for, and the words a
 * person might use for it when they do not know its name.
 *
 * English on purpose: the model translates into the reader's language, the same
 * way it handles every other stored string.
 *
 * Keep the routes in step with the sidebar in components/AppShell.tsx.
 */
import en from '@/i18n/messages/en'
import type { MessageKey } from '@/i18n/I18nProvider'
import type { ServerTranslate } from '@/i18n/server'

type Audience = 'developer' | 'agency' | 'both'

type Entry = {
  /** The page's title, as the sidebar labels it. */
  title: string
  /** Shown to the model and linked, so it has to be something a person can open. */
  route: string
  /** The sidebar's own label for it, so the assistant names a screen as the screen is named. */
  titleKey?: MessageKey
  /** The URL to recognise, where that differs from the one worth showing. `{id}` is any segment. */
  match?: string
  audience: Audience
  /** Key under `developerGuide.desc`. */
  desc: keyof typeof en.developerGuide.desc
  /** Key under `developerGuide.pages`, where the page has a three-step guide. */
  guide?: keyof typeof en.developerGuide.pages
  /** Other words someone might call it, so a search finds the page they mean. */
  also?: string[]
  /**
   * What is actually on the screen: the buttons, filters, columns and choices
   * someone has to find. The guide steps say what the page is for in three
   * lines; this is the part that answers "which button" and "what does that
   * column mean". Written here rather than in the catalog because no user-facing
   * text carries it.
   */
  details?: string[]
}

const ENTRIES: Entry[] = [
  { title: 'Home', route: '/dashboard', titleKey: 'nav.home', details: ["A period chooser at the top: month, quarter or year.", "Headline figures: units sold, revenue, money actually collected, each against target.", "Below: what needs attention today, recent activity, and a line per project with its own progress."], audience: 'both', desc: 'home', guide: 'dashboard', also: ['dashboard', 'overview', 'summary', 'home page'] },
  { title: 'Alerts', route: '/developer/alerts', titleKey: 'developerAlerts.nav', details: ["One card per rule, each switched on or off, with its own thresholds: how many minutes before an unanswered buyer counts as ignored, how many days of silence, how far behind target a project may fall, how low stock may get, what cancellation rate is too high.", "Only an owner or admin can change them; everyone else sees them read-only."], audience: 'developer', desc: 'alerts', guide: 'alerts', also: ['warnings', 'notifications rules', 'reminders settings'] },

  { title: 'Projects', route: '/developer/programs', titleKey: 'developer.navProjects', details: ["Each project is a card: its reference, city, status, cover photo, how much is sold or reserved, and the value sold against the target.", "Search by name, reference or city, and filter by status.", "\"New project\" asks for the name, address, delivery date, sales and revenue targets, and the commission rate used for every sale in it."], audience: 'developer', desc: 'projects', guide: 'projects', also: ['programmes', 'developments', 'residences', 'buildings'] },
  { title: "A project's own page", route: '/developer/programs (then open a project)', details: ["Tabs for the units, the construction milestones, the photos and plans, and the project settings.", "The units are shown floor by floor and colour-coded by status, so what is left is visible at a glance.", "Certifying a milestone here is what issues the calls for funds to every buyer in the project.", "The sales target, the delivery date and the commission rate are set here and drive the dashboard and the alerts."], match: '/developer/programs/{id}', audience: 'developer', desc: 'projects', guide: 'project', also: ['project page', 'project detail', 'milestones', 'stacking plan'] },
  { title: 'Units', route: '/developer/inventory', titleKey: 'developer.navInventory', details: ["Two views, top right: Table (one row per unit) and Building (floor by floor, nearest a stacking plan).", "Filters: project, building, status, type, salesperson, and a minimum and maximum price. \"Clear filters\" resets them.", "Columns: Unit (its number, with the project under it), Details (typology, area, floor), Price, Status, Buyer, Salesperson, Payments.", "Four figures across the top: total units, available, reserved (counting those on hold) and sold, each with its value.", "Clicking a row opens the unit to edit its price, status, buyer and salesperson. A sold unit also offers \"Cancel sale\", which asks for a reason."], audience: 'developer', desc: 'inventory', guide: 'inventory', also: ['inventory', 'stock', 'lots', 'apartments', 'flats', 'parking spaces', 'availability'] },
  { title: 'Templates', route: '/developer/templates', titleKey: 'developerSales.nav.templates', details: ["Pick the document: reservation form, sale contract, or payment reminder.", "The wording is yours to edit, with merge fields that fill in the buyer, the unit, the project, the prices and the dates when the document is issued.", "A template can be set for the whole workspace or for one project, and the preview shows it filled with sample data in your language and currency."], audience: 'developer', desc: 'templates', guide: 'templates', also: ['documents', 'reservation form', 'sale contract', 'wording'] },

  { title: 'Buyers', route: '/crm', titleKey: 'developer.navBuyers', details: ["Two views: a list (the default, sortable and filterable) and a Kanban board where a buyer is dragged between stages.", "Filters: status, stage, source, owner, and a search box. \"My contacts\" narrows it to your own.", "Columns: name, company, email, status, stage, value, source, tags and the last activity.", "A buyer opens a panel with their details, their budget and brief, their timeline of calls and visits, their follow-ups and their documents.", "Buyers arrive by hand with \"Add lead\", by import from a file, or on their own from the website enquiry form."], audience: 'both', desc: 'buyers', guide: 'buyers', also: ['leads', 'prospects', 'pipeline', 'crm', 'kanban of buyers', 'clients'] },
  { title: 'Site visits', route: '/developer/site-visits', titleKey: 'developerCrm.nav.siteVisits', details: ["Three tabs: upcoming visits, those needing their outcome recorded, and past ones.", "Booking a visit asks for the project, optionally a specific unit, the date and time, the length, the host and any notes.", "Recording the outcome asks whether they came, and if so how it went: interested, needs following up, reserved a unit, or not interested. A no-show or a follow-up outcome creates the follow-up task for the next day by itself."], audience: 'developer', desc: 'siteVisits', guide: 'siteVisits', also: ['visits', 'viewings of a project', 'appointments on site'] },
  { title: 'Follow-ups', route: '/developer/tasks', titleKey: 'developerCrm.nav.followUps', details: ["Follow-ups are grouped as overdue, due today, upcoming and done, in that order.", "A follow-up has a title, a type, a due date, an assignee and the buyer it concerns.", "Each can be marked done, reopened or deleted. The ones the system creates after a visit or a call are worded automatically.", "You can see only your own or the whole team's."], audience: 'developer', desc: 'followUps', guide: 'followUps', also: ['tasks', 'to-do', 'calls to make', 'reminders'] },

  { title: 'Collections', route: '/developer/collections', titleKey: 'developer.navCollections', details: ["Filter by status, and by project.", "A call for funds is listed with its number, its buyer and unit, the milestone that triggered it, the amount, the due date and its status.", "\"Record payment\" asks the date received, the method (bank transfer, cheque, cash, card or other) and a reference.", "Reminders to the buyer go out on a schedule: 7 days before, on the due day, then 3, 7 and 14 days late.", "An ageing chart shows how overdue the unpaid ones are."], audience: 'developer', desc: 'collections', guide: 'collections', also: ['calls for funds', 'payment requests', 'instalments', 'unpaid'] },
  { title: 'Modifications', route: '/developer/modifications', titleKey: 'developer.navModifications', details: ["Filter by status: requested, feasible, quoted, accepted, rejected or done.", "A request carries its reference, the buyer and unit, a category (finishes, electrical, plumbing, partitions, flooring or other), the description and the quoted price.", "The flow is: the site team confirms it can be built, a price is quoted, the buyer signs it from their portal, and the amount joins the price of their unit."], audience: 'developer', desc: 'modifications', guide: 'modifications', also: ['TMA', 'buyer changes', 'customisations', 'variations'] },
  { title: 'Commissions', route: '/commissions', titleKey: 'realEstate.nav.commissions', details: ["Tabs by state: accrued, earned and paid. An agency also gets a forecast tab.", "Each line shows the sale it came from, the basis it was calculated on, the rate and the amount.", "\"Mark as paid\" records a payout and cannot be undone.", "A commission can be split by percentage between people and the company; a member sees only their own shares."], audience: 'both', desc: 'commissions', guide: 'commissions', also: ['earnings', 'salesperson pay', 'splits'] },

  { title: 'Team activity', route: '/developer/team', titleKey: 'developerCrm.nav.teamActivity', details: ["Pick a period and compare the salespeople side by side.", "Per person: calls logged, visits held, follow-ups done, units reserved and sold, and the value they brought in."], audience: 'developer', desc: 'team', guide: 'team', also: ['who did what', 'performance', 'salespeople'] },
  { title: 'Reports', route: '/developer/reports', titleKey: 'developerSales.nav.reports', details: ["Four reports: sales, marketing, units and money. Each takes a period and optionally one project.", "Marketing follows the buyers created in the period through to where they got to, against the spend you enter by month and channel, giving cost per buyer and return.", "Every report exports to CSV."], audience: 'developer', desc: 'reports', guide: 'reports', also: ['figures', 'export', 'csv', 'statistics'] },

  { title: 'Pages', route: '/workspaces', titleKey: 'nav.pages', details: ["Pages are the workspace's notes and documents, written by your team and searchable.", "The assistant can read them: ask it something and it will search the pages and quote the one it used."], audience: 'both', desc: 'pages', also: ['notes', 'documents', 'wiki'] },
  { title: 'Task board', route: '/kanban-board-view', titleKey: 'nav.kanban', details: ["Cards move between To do, In progress and Done, with a priority of low, medium or high.", "Assigning a card notifies the person, and a card falling due soon notifies them again.", "This board is for internal work. Buyer follow-ups live on the Follow-ups screen instead."], audience: 'both', desc: 'kanban', also: ['kanban', 'internal tasks', 'cards'] },
  { title: 'Chat', route: '/chat', titleKey: 'nav.chat', details: ["Channels for the team, with mentions, reactions, file attachments and search.", "Being mentioned sends a notification, and an email if that is switched on."], audience: 'both', desc: 'chat', also: ['messages', 'team chat'] },
  { title: 'Meetings', route: '/meetings', titleKey: 'nav.meetings', details: ["Schedule meetings, keep their notes, and get a reminder before one starts.", "A calendar can be connected so bookings made elsewhere appear here too."], audience: 'both', desc: 'meetings', also: ['calendar', 'appointments', 'scheduling'] },
  { title: 'Email marketing', route: '/email-marketing', titleKey: 'nav.emailMarketing', details: ["Build a campaign, choose who receives it from a segment of your contacts, and send or schedule it.", "Automations can send a message when a buyer reaches a chosen pipeline stage.", "The analytics tab reports opens, clicks and bounces per campaign."], audience: 'both', desc: 'emailMarketing', also: ['newsletters', 'campaigns', 'mailing'] },
  { title: 'Quotes', route: '/quotes', titleKey: 'nav.quotes', details: ["Create a quote, send it to the client by email, and track whether they viewed, accepted or rejected it.", "An accepted quote can be turned into an invoice from the quote itself."], audience: 'both', desc: 'quotes', also: ['estimates', 'proposals'] },
  { title: 'Invoices', route: '/invoices', titleKey: 'nav.invoices', details: ["Create an invoice, send it by email with a payment link, and track its status.", "Unpaid invoices past their due date are marked overdue automatically, and you are notified."], audience: 'both', desc: 'invoices', also: ['billing', 'bills'] },

  { title: 'Listings', route: '/properties', titleKey: 'realEstate.nav.properties', details: ["Two views: a grid of listings, and the owner board where a property moves column by column from prospect to sold.", "Filters: status, type, city, minimum and maximum price, minimum bedrooms, plus a search by title, reference or city.", "A property holds its mandate, the buyers interested, the viewings booked and the offers received."], audience: 'agency', desc: 'properties', guide: 'properties', also: ['properties', 'portfolio', 'for sale'] },
  { title: 'Viewings', route: '/viewings', titleKey: 'realEstate.nav.viewings', details: ["Three tabs: upcoming, past, and those still needing feedback.", "Booking asks for the property, the buyer, the date and time, the length and any notes.", "Feedback is recorded against the viewing and surfaces on the property and for the owner."], audience: 'agency', desc: 'viewings', guide: 'viewings', also: ['visits to listings'] },
  { title: 'Mandates', route: '/mandates', titleKey: 'realEstate.nav.mandates', details: ["Tabs: expiring soon, active, expired, all.", "A mandate records its type (simple, semi-exclusive or exclusive), its fee, and its start and end dates.", "\"Renew\" extends it. Mandates ending within the warning window are listed first, and their owner is notified."], audience: 'agency', desc: 'mandates', guide: 'mandates', also: ['instructions', 'authority to sell'] },
  { title: 'Offers', route: '/offers', titleKey: 'realEstate.nav.offers', details: ["Offers are listed against their property with the buyer, the amount, the deposit and the date it is valid until.", "Financing is cash, mortgage or mixed; conditions can be finance, survey, a chain, or anything you write.", "Status is pending, accepted, rejected, withdrawn or expired. Accepting one rejects the competing offers and puts the property under offer."], audience: 'agency', desc: 'offers', guide: 'offers', also: ['bids'] },
  { title: 'Services', route: '/services', titleKey: 'realEstate.nav.services', details: ["The services and fees you sell, reused as lines on quotes and invoices."], audience: 'agency', desc: 'services', also: ['fees', 'catalogue'] },

  { title: 'Settings', route: '/settings', titleKey: 'nav.settings', details: ["Sections: profile, notifications, appearance, security, integrations, and plan and billing.", "Profile holds your name and your language, which also sets the language of the emails sent to you. The email address cannot be changed.", "Notifications are per category — team, sales, meetings, tasks — each switchable in the app and by email separately.", "Profile and billing also state which offer the account is on, agency or developer, chosen at sign-up and permanent."], audience: 'both', desc: 'home', also: ['profile', 'password', 'language', 'notifications', 'plan', 'billing', 'offer'] },
]

export interface PageDoc {
  title: string
  route: string
  /** One line: what the page is for. */
  purpose: string
  /** How to use it, in order. Absent for pages with no guide of their own. */
  steps?: string[]
  /** The controls and columns on it, for "which button" questions. */
  details?: string[]
  audience: Audience
}

const guideSteps = (key: keyof typeof en.developerGuide.pages): string[] => {
  const page = en.developerGuide.pages[key] as Record<string, string>
  return [page.step1, page.step2, page.step3].filter(Boolean)
}

const toDoc = (entry: Entry, t?: ServerTranslate): PageDoc => ({
  // Named as the reader's own sidebar names it, falling back to English.
  title: t && entry.titleKey ? t(entry.titleKey) : entry.title,
  route: entry.route,
  purpose: en.developerGuide.desc[entry.desc],
  ...(entry.guide ? { steps: guideSteps(entry.guide) } : {}),
  ...(entry.details?.length ? { details: entry.details } : {}),
  audience: entry.audience,
})

/** Everything the workspace's kind actually shows; the other half would only mislead. */
export function pagesFor(isDeveloper: boolean, t?: ServerTranslate): PageDoc[] {
  const wanted: Audience = isDeveloper ? 'developer' : 'agency'
  return ENTRIES.filter((e) => e.audience === 'both' || e.audience === wanted).map((e) => toDoc(e, t))
}

/** The page a route belongs to, so "this page" means something. `{id}` segments match. */
export function pageForRoute(path: string, isDeveloper: boolean, t?: ServerTranslate): PageDoc | null {
  const clean = path.split('?')[0].replace(/\/+$/, '') || '/'
  const candidates = ENTRIES.filter((e) => e.audience === 'both' || e.audience === (isDeveloper ? 'developer' : 'agency'))
  // Longest route first, so /developer/programs/{id} wins over /developer/programs.
  const routeOf = (e: Entry) => e.match ?? e.route
  const sorted = [...candidates].sort((a, b) => routeOf(b).length - routeOf(a).length)
  const match = sorted.find((e) => {
    const pattern = new RegExp(`^${routeOf(e).replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\\\{id\\\}/g, '[^/]+')}$`)
    return pattern.test(clean)
  })
  return match ? toDoc(match, t) : null
}

/** The words of a question worth matching on, with the empty ones dropped. */
export function searchWords(query: string): string[] {
  return query
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((w) => w.length > 2 && !NOISE.has(w))
}

/**
 * Words that say nothing about which screen is meant. Without this, "how does
 * this page work" matched the Pages screen on the word "page" and answered
 * about the wrong one.
 */
const NOISE = new Set([
  'the', 'this', 'that', 'page', 'pages', 'screen', 'app', 'how', 'does', 'what', 'where',
  'work', 'works', 'use', 'using', 'here', 'with', 'for', 'and', 'can', 'see', 'show', 'tell',
])

/** Pages matching what someone typed, by title, route, purpose, steps or nickname. */
export function searchPages(query: string, isDeveloper: boolean, t?: ServerTranslate): PageDoc[] {
  const words = searchWords(query)
  if (words.length === 0) return []
  const wanted: Audience = isDeveloper ? 'developer' : 'agency'
  const scored = ENTRIES.filter((e) => e.audience === 'both' || e.audience === wanted)
    .map((entry) => {
      const doc = toDoc(entry, t)
      const title = `${entry.title} ${(entry.also ?? []).join(' ')} ${entry.route}`.toLowerCase()
      const body = `${doc.purpose} ${(doc.steps ?? []).join(' ')}`.toLowerCase()
      // A word in the name is worth more than the same word buried in the text.
      const score = words.reduce((sum, w) => sum + (title.includes(w) ? 3 : 0) + (body.includes(w) ? 1 : 0), 0)
      return { doc, score }
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
  return scored.slice(0, 4).map((r) => r.doc)
}
