/**
 * A lead's coarse status (new, contacted, qualified, proposal, negotiation, won,
 * lost) follows its pipeline stage.
 *
 * Both used to be edited separately, so a buyer could sit in the "New" column
 * marked "Contacted", or be "Won" while still "Qualified" on the board. The stage
 * is what the boards, the funnel, the alerts and the automations use, so it is
 * the one people edit; for the built-in stages the status is derived from it.
 * A stage a workspace invented maps to nothing, and its status stays whatever
 * was chosen by hand.
 *
 * Pure data: the server writes it, the screens read it.
 */
export type LeadStatus = 'new' | 'contacted' | 'qualified' | 'proposal' | 'negotiation' | 'won' | 'lost'

const STATUS_BY_STAGE: Record<string, LeadStatus> = {
  // Contacts
  New: 'new',
  Contacted: 'contacted',
  Qualified: 'qualified',
  Nurturing: 'contacted',
  Lost: 'lost',
  // Buyer journey (agencies)
  Enquiry: 'new',
  'Brief recorded': 'qualified',
  'Viewing booked': 'proposal',
  'Viewing done': 'proposal',
  Offer: 'negotiation',
  'Under contract': 'won',
  Closed: 'won',
  // Owner / mandate
  Prospect: 'new',
  'Valuation booked': 'contacted',
  'Valuation done': 'qualified',
  'Mandate signed': 'won',
  Live: 'won',
  'Under offer': 'won',
  Sold: 'won',
  // Buyer sales (developers)
  'Site visit': 'proposal',
  Negotiation: 'negotiation',
  Reserved: 'won',
  Won: 'won',
}

/** The status a built-in stage implies, or null for a stage the workspace made up. */
export function leadStatusForStage(stage: string | null | undefined): LeadStatus | null {
  return (stage && STATUS_BY_STAGE[stage]) || null
}

/** The status to show: the stage's when it implies one, otherwise the stored one. */
export function effectiveLeadStatus(lead: { stage?: string | null; status?: string | null }): string {
  return leadStatusForStage(lead.stage) ?? lead.status ?? 'new'
}
