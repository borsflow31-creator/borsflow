import { escapeHtml } from '@/lib/html'

/**
 * Filling a reservation form, contract or payment reminder from a template.
 *
 * Pure, so the rules that stop a bad document reaching a buyer can be proved
 * without a database. The two failure modes that matter in a legal document are
 * handled differently on purpose:
 *
 *   an unknown placeholder    {{buyr_name}} -- a typo in the template. Left in the
 *                             text as written and reported, so issuing refuses and
 *                             the author sees exactly which one, rather than a
 *                             document with a hole where the buyer's name should be.
 *   a known one with no value {{reservation_fee}} on a sale with no deposit. Shown
 *                             as a blank line to be filled in by hand, and reported
 *                             as a warning, because the template is right and the
 *                             sale simply lacks the fact.
 */

/** Every placeholder the templates may use. The templates page lists these. */
export const MERGE_FIELDS = [
  'document_number',
  'date',
  'developer',
  'buyer_name',
  'buyer_email',
  'buyer_phone',
  'project',
  'project_address',
  'unit',
  'unit_type',
  'typology',
  'floor',
  'surface',
  'list_price',
  'discount',
  'net_price',
  'vat_rate',
  'final_price',
  'reservation_fee',
  'agent',
  // Payment reminders
  'amount_due',
  'milestone',
  'due_date',
  'portal_link',
] as const
export type MergeField = (typeof MERGE_FIELDS)[number]

const KNOWN = new Set<string>(MERGE_FIELDS)

/** What stands in for a fact the sale does not have: a line to write on. */
export const BLANK = '________'

const PLACEHOLDER = /\{\{\s*([a-z0-9_]+)\s*\}\}/gi

export interface MergeResult {
  text: string
  /** Placeholders the template uses that do not exist. Issuing must refuse these. */
  unknown: string[]
  /** Known placeholders that had no value for this sale, left as a blank line. */
  missing: string[]
}

/**
 * Substitute `{{field}}` placeholders. Matching is case-insensitive and tolerates
 * spaces inside the braces, because templates are typed by people.
 *
 * `html` escapes the finished text, static wording and values alike: substitution
 * happens on plain text first, so a value cannot smuggle markup in and the
 * template author cannot either.
 */
export function renderTemplate(
  body: string,
  values: Partial<Record<string, string | null | undefined>>,
  mode: 'text' | 'html' = 'text'
): MergeResult {
  const unknown = new Set<string>()
  const missing = new Set<string>()

  const text = body.replace(PLACEHOLDER, (whole, rawName: string) => {
    const name = rawName.toLowerCase()
    if (!KNOWN.has(name)) {
      unknown.add(name)
      return whole
    }
    const value = values[name]
    if (value === undefined || value === null || String(value).trim() === '') {
      missing.add(name)
      return BLANK
    }
    return String(value)
  })

  return {
    text: mode === 'html' ? escapeHtml(text) : text,
    unknown: [...unknown],
    missing: [...missing],
  }
}

/** The placeholders a template uses, so the editor can warn before it is saved. */
export function placeholdersIn(body: string): string[] {
  const found = new Set<string>()
  for (const match of body.matchAll(PLACEHOLDER)) found.add(match[1].toLowerCase())
  return [...found]
}

export type TemplateKind = 'reservation' | 'contract' | 'payment_reminder'
export const TEMPLATE_KINDS: readonly TemplateKind[] = ['reservation', 'contract', 'payment_reminder']

export function isTemplateKind(v: unknown): v is TemplateKind {
  return typeof v === 'string' && (TEMPLATE_KINDS as readonly string[]).includes(v)
}

const DRAFT_NOTICE =
  'DRAFT WORDING: replace this text with your own, reviewed by your lawyer, before sending it to a buyer.'

/**
 * What a workspace gets until it writes its own. Deliberately plain and marked as
 * a draft in the document itself: the product must not appear to supply legal
 * wording for any jurisdiction, but it has to work out of the box.
 */
export const DEFAULT_TEMPLATES: Record<TemplateKind, { name: string; subject: string | null; body: string }> = {
  reservation: {
    name: 'Reservation form',
    subject: null,
    body: `${DRAFT_NOTICE}

RESERVATION FORM {{document_number}}
Date: {{date}}

Between {{developer}} (the developer) and {{buyer_name}} (the buyer), {{buyer_email}}, {{buyer_phone}}.

The buyer reserves unit {{unit}} ({{unit_type}}, {{typology}}, floor {{floor}}, {{surface}} m²) in the project {{project}}, {{project_address}}.

Price
List price: {{list_price}}
Discount: {{discount}}
Price excluding VAT: {{net_price}}
VAT ({{vat_rate}}): included in the final price
Final price: {{final_price}}

Reservation deposit: {{reservation_fee}}

The unit is withdrawn from sale for the buyer while this reservation stands. The terms on which the buyer may withdraw, and what happens to the deposit, are those agreed between the parties.

Agent: {{agent}}`,
  },
  contract: {
    name: 'Sales contract',
    subject: null,
    body: `${DRAFT_NOTICE}

SALES CONTRACT {{document_number}}
Date: {{date}}

Between {{developer}} (the seller) and {{buyer_name}} (the buyer), {{buyer_email}}, {{buyer_phone}}.

The seller sells and the buyer buys unit {{unit}} ({{unit_type}}, {{typology}}, floor {{floor}}, {{surface}} m²) in the project {{project}}, {{project_address}}.

Price
List price: {{list_price}}
Discount: {{discount}}
Price excluding VAT: {{net_price}}
VAT ({{vat_rate}}): included in the final price
Final price: {{final_price}}

Deposit already received: {{reservation_fee}}

The balance is payable in instalments called by the seller as construction milestones are certified.

Agent: {{agent}}`,
  },
  payment_reminder: {
    name: 'Payment reminder',
    subject: 'Payment {{milestone}} for unit {{unit}}',
    body: `Dear {{buyer_name}},

This is a reminder that a payment of {{amount_due}} for {{milestone}} on unit {{unit}} in {{project}} is due on {{due_date}}.

You can see the details and your documents in your purchase space: {{portal_link}}

If you have already paid, thank you, and please disregard this message.

{{developer}}`,
  },
}
