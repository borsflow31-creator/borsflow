/**
 * Who may see a document.
 *
 * Two levels, deliberately: 'team' (every member of the workspace, which is how
 * every file behaved before this) and 'managers' (owners and admins). A contract, an
 * identity document or a payment receipt is the kind of thing most of a sales team
 * has no reason to open, and until now a view-only member could download all of it.
 *
 * Pure, so the rule that every read path shares is proved once. The paths
 * themselves (the file list and download, the timeline, the sales-document list and
 * PDF, the customer overview, the AI tools) each apply it; a rule enforced in one
 * of them only hides a document from the screen that was remembered.
 */

export const DOCUMENT_VISIBILITIES = ['team', 'managers'] as const
export type DocumentVisibility = (typeof DOCUMENT_VISIBILITIES)[number]

export function isDocumentVisibility(v: unknown): v is DocumentVisibility {
  return typeof v === 'string' && (DOCUMENT_VISIBILITIES as readonly string[]).includes(v)
}

/**
 * May this person see a document of this visibility?
 *
 * Fails closed: a value that is not 'team' (a typo, a future level, null from a bad
 * row) is treated as managers-only, so an unexpected value hides a document rather
 * than exposing it.
 */
export function canViewDocument(canModerate: boolean, visibility: string | null | undefined): boolean {
  if (canModerate) return true
  return visibility === 'team'
}

/**
 * The Prisma `where` fragment for "only documents this person may see". Empty for
 * owners and admins. Spread it into any query that lists documents, so listing
 * cannot forget the rule that a single read applies.
 */
export function visibleDocumentsWhere(canModerate: boolean): { visibility?: 'team' } {
  return canModerate ? {} : { visibility: 'team' }
}

/**
 * The visibility a new document is created with. Only owners and admins may mark
 * something managers-only; anyone else's request is ignored and the file stays
 * visible to the team, which is how every file behaved before this existed.
 */
export function visibilityForUpload(canModerate: boolean, requested: unknown): DocumentVisibility {
  if (canModerate && isDocumentVisibility(requested)) return requested
  return 'team'
}
