/**
 * The built-in pipeline and stage names, which are stored in English as data
 * (a workspace can rename them, see DEFAULT_PIPELINES in ./lifecycle). The
 * screens show the default ones in the reader's language through these keys
 * (`crmDefaults.pipelines.*`, `crmDefaults.stages.*`); a renamed or custom name
 * matches nothing and is shown exactly as typed.
 */
export const DEFAULT_PIPELINE_KEYS: Record<string, string> = {
  "Contacts": "contacts",
  "Buyer journey": "buyerJourney",
  "Owner / mandate": "ownerMandate",
  "Buyer sales": "buyerSales"
}

export const DEFAULT_STAGE_KEYS: Record<string, string> = {
  "New": "new",
  "Contacted": "contacted",
  "Qualified": "qualified",
  "Nurturing": "nurturing",
  "Lost": "lost",
  "Enquiry": "enquiry",
  "Brief recorded": "briefRecorded",
  "Viewing booked": "viewingBooked",
  "Viewing done": "viewingDone",
  "Offer": "offer",
  "Under contract": "underContract",
  "Closed": "closed",
  "Prospect": "prospect",
  "Valuation booked": "valuationBooked",
  "Valuation done": "valuationDone",
  "Mandate signed": "mandateSigned",
  "Live": "live",
  "Under offer": "underOffer",
  "Sold": "sold",
  "Site visit": "siteVisit",
  "Negotiation": "negotiation",
  "Reserved": "reserved",
  "Won": "won"
}
