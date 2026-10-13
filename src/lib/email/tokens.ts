/**
 * The `{{tokens}}` an email may carry: what they are called, what to call them
 * in the editor, and what they look like filled in.
 *
 * This is the single list. `buildTokenMap` in render.ts declares its return type
 * from it, so a token offered here that nothing fills in — or a value built
 * there that is never offered — is a type error rather than an email that goes
 * out with a blank where a price should be. The editor's insert-field menu used
 * to hold four hardcoded names while the renderer resolved twenty-seven, so a
 * sender could not reach most of them and a typo rendered as nothing.
 *
 * It imports nothing, because both the send path and the browser read it.
 */

export interface EmailTokenGroup {
  id: 'contact' | 'property' | 'deal' | 'sender'
  /** i18n key, under emailMarketing.tokenGroups */
  labelKey: string
  tokens: EmailToken[]
}

export interface EmailToken {
  name: string
  /** i18n key, under emailMarketing.tokens */
  labelKey: string
  /** What the preview shows in its place, so a draft reads like a real email. */
  sample: string
}

/**
 * Generic in the name, and the groups below are left unannotated, so each token's
 * name keeps its literal type. That is what makes EmailTokenName a union of the
 * actual names rather than `string` — and so what makes the renderer's
 * Record<EmailTokenName, string> catch a token nothing fills in.
 */
const token = <Name extends string>(name: Name, sample: string) => ({
  name,
  labelKey: `emailMarketing.tokens.${name}` as const,
  sample,
})

export const EMAIL_TOKEN_GROUPS = [
  {
    id: 'contact',
    labelKey: 'emailMarketing.tokenGroups.contact',
    tokens: [
      token('first_name', 'Amina'),
      token('last_name', 'Benali'),
      token('full_name', 'Amina Benali'),
      token('name', 'Amina Benali'),
      token('email', 'amina.benali@example.com'),
      token('phone', '+213 550 12 34 56'),
      token('company', 'Benali & Co'),
      token('position', 'Director'),
    ],
  },
  {
    id: 'property',
    labelKey: 'emailMarketing.tokenGroups.property',
    tokens: [
      token('property_title', 'Three-bedroom apartment with sea view'),
      token('property_reference', 'REF-2048'),
      token('property_city', 'Oran'),
      token('property_district', 'Bir El Djir'),
      token('property_type', 'Apartment'),
      token('property_price', '16,500,000'),
      token('property_bedrooms', '3'),
      token('property_surface', '112'),
    ],
  },
  {
    id: 'deal',
    labelKey: 'emailMarketing.tokenGroups.deal',
    tokens: [
      token('stage', 'Qualified'),
      token('status', 'Won'),
      token('source', 'Website'),
      token('value', '16,500,000'),
      token('pipeline_name', 'Buyers'),
      token('interest_stage', 'Offer'),
      token('mandate_reference', 'MND-114'),
      token('asking_price', '17,200,000'),
      token('mandate_end_date', '2027-03-31'),
    ],
  },
  {
    id: 'sender',
    labelKey: 'emailMarketing.tokenGroups.sender',
    tokens: [
      token('company_name', 'Horizon Immobilier'),
      token('unsubscribe_url', 'https://example.com/unsubscribe'),
    ],
  },
] as const satisfies readonly EmailTokenGroup[]

/** Every token, in the order the editor offers them. */
export const EMAIL_TOKENS = EMAIL_TOKEN_GROUPS.flatMap(group => group.tokens as readonly EmailToken[] as EmailToken[])

/**
 * The names as a union, so the renderer's token map must cover exactly these.
 * Derived from the groups rather than written out a second time.
 */
export type EmailTokenName = (typeof EMAIL_TOKEN_GROUPS)[number]['tokens'][number]['name']

const NAMES = new Set<string>(EMAIL_TOKENS.map(entry => entry.name))

export function isEmailToken(name: string): boolean {
  return NAMES.has(name.toLowerCase())
}

/**
 * Stand-in values for a preview. Not a send: nothing here reaches a recipient,
 * so an obviously fictional contact is the point — a preview showing a real
 * lead's name would be mistaken for the real thing.
 */
export function sampleTokenValues(workspaceName?: string | null): Record<string, string> {
  const values: Record<string, string> = {}
  for (const entry of EMAIL_TOKENS) values[entry.name] = entry.sample
  if (workspaceName) values.company_name = workspaceName
  return values
}

/** Fill in `{{tokens}}` with the sample values, for a preview. */
export function renderWithSamples(content: string, workspaceName?: string | null): string {
  if (!content) return content
  const values = sampleTokenValues(workspaceName)
  return content.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (match, raw: string) => {
    const key = String(raw).toLowerCase()
    // An unknown token is left as it was written: in a preview that is the point
    // where a typo becomes visible, rather than silently rendering as nothing.
    return key in values ? values[key] : match
  })
}
