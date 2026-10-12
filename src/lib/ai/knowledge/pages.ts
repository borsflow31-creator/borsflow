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

type Audience = 'developer' | 'agency' | 'both'

type Entry = {
  /** The page's title, as the sidebar labels it. */
  title: string
  /** Shown to the model and linked, so it has to be something a person can open. */
  route: string
  /** The URL to recognise, where that differs from the one worth showing. `{id}` is any segment. */
  match?: string
  audience: Audience
  /** Key under `developerGuide.desc`. */
  desc: keyof typeof en.developerGuide.desc
  /** Key under `developerGuide.pages`, where the page has a three-step guide. */
  guide?: keyof typeof en.developerGuide.pages
  /** Other words someone might call it, so a search finds the page they mean. */
  also?: string[]
}

const ENTRIES: Entry[] = [
  { title: 'Home', route: '/dashboard', audience: 'both', desc: 'home', guide: 'dashboard', also: ['dashboard', 'overview', 'summary', 'home page'] },
  { title: 'Alerts', route: '/developer/alerts', audience: 'developer', desc: 'alerts', guide: 'alerts', also: ['warnings', 'notifications rules', 'reminders settings'] },

  { title: 'Projects', route: '/developer/programs', audience: 'developer', desc: 'projects', guide: 'projects', also: ['programmes', 'developments', 'residences', 'buildings'] },
  { title: "A project's own page", route: '/developer/programs (then open a project)', match: '/developer/programs/{id}', audience: 'developer', desc: 'projects', guide: 'project', also: ['project page', 'project detail', 'milestones', 'stacking plan'] },
  { title: 'Units', route: '/developer/inventory', audience: 'developer', desc: 'inventory', guide: 'inventory', also: ['inventory', 'stock', 'lots', 'apartments', 'flats', 'parking spaces', 'availability'] },
  { title: 'Templates', route: '/developer/templates', audience: 'developer', desc: 'templates', guide: 'templates', also: ['documents', 'reservation form', 'sale contract', 'wording'] },

  { title: 'Buyers', route: '/crm', audience: 'both', desc: 'buyers', guide: 'buyers', also: ['leads', 'prospects', 'pipeline', 'crm', 'kanban of buyers', 'clients'] },
  { title: 'Site visits', route: '/developer/site-visits', audience: 'developer', desc: 'siteVisits', guide: 'siteVisits', also: ['visits', 'viewings of a project', 'appointments on site'] },
  { title: 'Follow-ups', route: '/developer/tasks', audience: 'developer', desc: 'followUps', guide: 'followUps', also: ['tasks', 'to-do', 'calls to make', 'reminders'] },

  { title: 'Collections', route: '/developer/collections', audience: 'developer', desc: 'collections', guide: 'collections', also: ['calls for funds', 'payment requests', 'instalments', 'unpaid'] },
  { title: 'Modifications', route: '/developer/modifications', audience: 'developer', desc: 'modifications', guide: 'modifications', also: ['TMA', 'buyer changes', 'customisations', 'variations'] },
  { title: 'Commissions', route: '/commissions', audience: 'both', desc: 'commissions', guide: 'commissions', also: ['earnings', 'salesperson pay', 'splits'] },

  { title: 'Team activity', route: '/developer/team', audience: 'developer', desc: 'team', guide: 'team', also: ['who did what', 'performance', 'salespeople'] },
  { title: 'Reports', route: '/developer/reports', audience: 'developer', desc: 'reports', guide: 'reports', also: ['figures', 'export', 'csv', 'statistics'] },

  { title: 'Pages', route: '/workspaces', audience: 'both', desc: 'pages', also: ['notes', 'documents', 'wiki'] },
  { title: 'Task board', route: '/kanban-board-view', audience: 'both', desc: 'kanban', also: ['kanban', 'internal tasks', 'cards'] },
  { title: 'Chat', route: '/chat', audience: 'both', desc: 'chat', also: ['messages', 'team chat'] },
  { title: 'Meetings', route: '/meetings', audience: 'both', desc: 'meetings', also: ['calendar', 'appointments', 'scheduling'] },
  { title: 'Email marketing', route: '/email-marketing', audience: 'both', desc: 'emailMarketing', also: ['newsletters', 'campaigns', 'mailing'] },
  { title: 'Quotes', route: '/quotes', audience: 'both', desc: 'quotes', also: ['estimates', 'proposals'] },
  { title: 'Invoices', route: '/invoices', audience: 'both', desc: 'invoices', also: ['billing', 'bills'] },

  { title: 'Listings', route: '/properties', audience: 'agency', desc: 'properties', also: ['properties', 'portfolio', 'for sale'] },
  { title: 'Viewings', route: '/viewings', audience: 'agency', desc: 'viewings', also: ['visits to listings'] },
  { title: 'Mandates', route: '/mandates', audience: 'agency', desc: 'mandates', also: ['instructions', 'authority to sell'] },
  { title: 'Offers', route: '/offers', audience: 'agency', desc: 'offers', also: ['bids'] },
  { title: 'Services', route: '/services', audience: 'agency', desc: 'services', also: ['fees', 'catalogue'] },

  { title: 'Settings', route: '/settings', audience: 'both', desc: 'home', also: ['profile', 'password', 'language', 'notifications', 'plan', 'billing', 'offer'] },
]

export interface PageDoc {
  title: string
  route: string
  /** One line: what the page is for. */
  purpose: string
  /** How to use it, in order. Absent for pages with no guide of their own. */
  steps?: string[]
  audience: Audience
}

const guideSteps = (key: keyof typeof en.developerGuide.pages): string[] => {
  const page = en.developerGuide.pages[key] as Record<string, string>
  return [page.step1, page.step2, page.step3].filter(Boolean)
}

const toDoc = (entry: Entry): PageDoc => ({
  title: entry.title,
  route: entry.route,
  purpose: en.developerGuide.desc[entry.desc],
  ...(entry.guide ? { steps: guideSteps(entry.guide) } : {}),
  audience: entry.audience,
})

/** Everything the workspace's kind actually shows; the other half would only mislead. */
export function pagesFor(isDeveloper: boolean): PageDoc[] {
  const wanted: Audience = isDeveloper ? 'developer' : 'agency'
  return ENTRIES.filter((e) => e.audience === 'both' || e.audience === wanted).map(toDoc)
}

/** The page a route belongs to, so "this page" means something. `{id}` segments match. */
export function pageForRoute(path: string, isDeveloper: boolean): PageDoc | null {
  const clean = path.split('?')[0].replace(/\/+$/, '') || '/'
  const candidates = ENTRIES.filter((e) => e.audience === 'both' || e.audience === (isDeveloper ? 'developer' : 'agency'))
  // Longest route first, so /developer/programs/{id} wins over /developer/programs.
  const routeOf = (e: Entry) => e.match ?? e.route
  const sorted = [...candidates].sort((a, b) => routeOf(b).length - routeOf(a).length)
  const match = sorted.find((e) => {
    const pattern = new RegExp(`^${routeOf(e).replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\\\{id\\\}/g, '[^/]+')}$`)
    return pattern.test(clean)
  })
  return match ? toDoc(match) : null
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
export function searchPages(query: string, isDeveloper: boolean): PageDoc[] {
  const words = query
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((w) => w.length > 2 && !NOISE.has(w))
  if (words.length === 0) return []
  const wanted: Audience = isDeveloper ? 'developer' : 'agency'
  const scored = ENTRIES.filter((e) => e.audience === 'both' || e.audience === wanted)
    .map((entry) => {
      const doc = toDoc(entry)
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
