/**
 * The rules of the business, as against the layout of the screens.
 *
 * `./pages` answers "where do I do this". This answers "what happens when I
 * do". Those are the questions a screen guide cannot carry, because the answer
 * spans several screens or happens without anyone opening one: that signing a
 * contract creates a commission, that certifying a milestone bills every buyer
 * in the project at once, what an off-plan sale is.
 *
 * Written from the services that actually implement each rule, named in the
 * comments so a change there can be followed here. English, like ./pages: the
 * model translates.
 */

export interface Concept {
  /** What someone would call it. */
  title: string
  /** Who the rule applies to, so the other half's workspace never sees it. */
  audience: 'developer' | 'agency' | 'both'
  /** The rule, in plain words. */
  body: string
  /** Words someone might use for it when they do not know the term. */
  also?: string[]
}

const CONCEPTS: Concept[] = [
  // ── Selling off plan ──────────────────────────────────────────────────────
  {
    title: 'Selling off plan (VSP / VEFA)',
    audience: 'developer',
    also: ['vsp', 'vefa', 'vente sur plans', 'off plan', 'before it is built'],
    body:
      'A developer sells a unit before the building exists, so the buyer pays in instalments as construction advances rather than all at once at the end. ' +
      'In Algeria this is the VSP (vente sur plans) under Law 11-04; in France the equivalent is the VEFA. ' +
      'Everything else follows from it: the buyer is tied to a unit long before they can move in, the money arrives against certified progress, and the law requires a completion guarantee so the buyer is covered if the developer fails.',
  },
  {
    title: 'The life of a unit',
    audience: 'developer',
    also: ['unit status', 'available', 'on hold', 'optioned', 'reserved', 'contract signed', 'deed', 'delivered', 'what the statuses mean'],
    body:
      'A unit moves: available -> on hold (optioned) -> reserved -> contract signed -> deed signed -> delivered. ' +
      'On hold is a short informal hold while a buyer decides. Reserved means a reservation contract and usually a deposit. Contract signed is the sale contract. Deed signed is the notarised deed, the point the sale is legally complete. Delivered is handover of the keys. ' +
      'The dashboard and the project pages group these: on hold and reserved count together as "reserved", and contract signed, deed signed and delivered all count as "sold".',
  },
  {
    title: 'Calls for funds',
    audience: 'developer',
    also: ['appel de fonds', 'instalment', 'payment request', 'milestone billing', 'how buyers pay'],
    body:
      'A call for funds is the invoice that asks a buyer for the next instalment. They are not written by hand: certifying a construction milestone on a project issues a call to every buyer in that project at once, each for that milestone\'s percentage of their own price, unless that is turned off when certifying. ' +
      'A call is issued, then paid, or overdue once its due date passes. Marking it paid records the money. Buyers are chased automatically by a nightly reminder, and the developer is warned when a payment is late.',
  },
  {
    title: 'Buyer modifications (TMA)',
    audience: 'developer',
    also: ['tma', 'travaux modificatifs', 'change order', 'customisation', 'variations'],
    body:
      'A buyer can ask for changes to their own unit while it is being built: moving a partition, different finishes, extra sockets. ' +
      'The request is checked for feasibility by the site team, then quoted. The buyer signs the quote from their buyer portal, and the amount is added to the price of their unit, which means it also changes what the commission is calculated on.',
  },
  {
    title: 'The buyer portal',
    audience: 'developer',
    also: ['client space', 'what the buyer sees', 'portal link', 'espace client'],
    body:
      'Each sold unit has a private web page its buyer can open from a link, with no account to create. It shows construction progress and site photos, their unit\'s details, their calls for funds and documents, and lets them request and sign modifications. ' +
      'Money and documents are hidden until the buyer confirms a code sent to their email address, so a forwarded link does not expose them. The portal is in the buyer\'s own language.',
  },
  {
    title: 'How a developer sale runs, end to end',
    audience: 'developer',
    also: ['whole process', 'from enquiry to keys', 'workflow', 'steps of a sale'],
    body:
      'An enquiry arrives (from the website, Ouedkniss, Facebook, a walk-in) and becomes a buyer in the pipeline. A salesperson calls, books a site visit, and records how it went. ' +
      'The buyer picks a unit: it goes on hold, then reserved, and the reservation form is issued from a template. The sale contract follows, which creates the commission. ' +
      'Through construction, each certified milestone bills every buyer. The buyer may ask for modifications. At the deed the sale completes and the commission becomes earned. Finally the unit is delivered and any snags are tracked under warranty.',
  },

  // ── Agency ────────────────────────────────────────────────────────────────
  {
    title: 'How an agency sale runs, end to end',
    audience: 'agency',
    also: ['whole process', 'workflow', 'steps of a sale', 'from owner to sale'],
    body:
      'An owner is courted as a prospect, the property is valued, and a mandate is signed, which is what gives the agency the right to sell it. The property then goes on the market. ' +
      'Buyers register their brief, are matched to listings, and are taken on viewings whose feedback goes back to the owner. Offers are recorded and compared; accepting one puts the property under offer and rejects the rest. The sale completes and the commission is split between whoever won the mandate and whoever found the buyer.',
  },
  {
    title: 'Mandate types',
    audience: 'agency',
    also: ['simple', 'exclusive', 'semi-exclusive', 'what kind of mandate'],
    body:
      'A simple mandate lets the owner and other agencies sell the property as well. An exclusive mandate gives one agency the sole right for its term. A semi-exclusive one keeps other agencies out but still lets the owner sell it themselves. ' +
      'Every mandate has an end date. Past it, the authority to sell is gone and the listing must come off the market, so the system warns before a mandate expires.',
  },
  {
    title: 'Matching buyers to listings',
    audience: 'agency',
    also: ['property match', 'search brief', 'who wants this', 'buyer brief'],
    body:
      'A buyer\'s brief records what they want: budget, area, number of bedrooms, where. When a listing is published that fits an open brief, the agent who holds that buyer is told, so a new instruction reaches the right people before it is advertised.',
  },

  // ── Both ──────────────────────────────────────────────────────────────────
  {
    title: 'Commissions',
    audience: 'both',
    also: ['accrued', 'realized', 'earned', 'paid', 'who gets what', 'splits', 'my pay'],
    body:
      'A commission is created automatically when a sale reaches the point of no return: for a developer, the signed sale contract; for an agency, the accepted offer. It is then "accrued" — owed in principle but not yet earned. ' +
      'At the notarised deed it becomes "earned", recalculated on the unit\'s price as it then stands, so a buyer modification changes it. Marking it "paid" records the payout. Cancelling a sale cancels an accrued commission, but one already earned stands. ' +
      'A commission can be split by percentage between the people involved and the company itself.',
  },
  {
    title: 'Who can see and do what',
    audience: 'both',
    also: ['roles', 'permissions', 'owner', 'admin', 'member', 'access', 'rights'],
    body:
      'Everyone in a workspace has a role. The owner and admins can change settings, see every record and everyone\'s commissions, and edit the alert rules. A member works their own records: they see the whole pipeline but only their own commission shares, and cannot change settings or alerts. ' +
      'Documents are visible to the team by default, and an owner or admin can lock one so only managers see it.',
  },
  {
    title: 'Alerts',
    audience: 'developer',
    also: ['warnings', 'automatic', 'no response', 'behind target', 'low stock'],
    body:
      'The system watches for things going wrong and tells the people who can act: a new buyer nobody has answered, a buyer nothing has been booked with for days, a project selling behind the straight line from launch to delivery, a project almost out of stock, an unusual run of cancellations, a payment overdue. ' +
      'Each one is a rule with its own thresholds, which an owner or admin can tune or switch off. They arrive as notifications, and by email for whoever has those switched on.',
  },
  {
    title: 'The language of the app and its emails',
    audience: 'both',
    also: ['language', 'translate', 'french', 'arabic', 'change language'],
    body:
      'Each person chooses their language when they sign up, and can change it with the language switcher. Their notifications and the emails the system sends them are written in that language, independently of what their colleagues chose. ' +
      'The buyer portal follows the buyer\'s own browser instead, since a buyer has no account.',
  },
  {
    title: 'AI credits',
    audience: 'both',
    also: ['credits', 'cost of the assistant', 'allowance', 'ai usage'],
    body:
      'Asking the assistant something spends credits from the workspace\'s plan allowance, counted from the tokens the question and the answer actually used, so a short question costs less than a long report. Every request costs at least one credit. The plan page shows what is left.',
  },
]

/** The concepts that apply to this kind of workspace. */
export function conceptsFor(isDeveloper: boolean): Concept[] {
  const wanted = isDeveloper ? 'developer' : 'agency'
  return CONCEPTS.filter((c) => c.audience === 'both' || c.audience === wanted)
}

/** Concepts matching what someone asked, best first. */
export function searchConcepts(query: string, isDeveloper: boolean, words: string[]): Concept[] {
  if (words.length === 0) return []
  return conceptsFor(isDeveloper)
    .map((concept) => {
      const name = `${concept.title} ${(concept.also ?? []).join(' ')}`.toLowerCase()
      const body = concept.body.toLowerCase()
      const score = words.reduce((sum, w) => sum + (name.includes(w) ? 3 : 0) + (body.includes(w) ? 1 : 0), 0)
      return { concept, score }
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((r) => r.concept)
}
