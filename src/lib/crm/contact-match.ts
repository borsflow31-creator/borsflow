/**
 * The rules that decide whether a new lead is someone the workspace already
 * has, and whether the units it was given can be attached to it. Pure, so the
 * verify scripts can prove them without a database.
 */

/** An email as it is compared: trimmed and lowercased. Empty is null. */
export function normalizeEmail(value: string | null | undefined): string | null {
  const email = (value ?? '').trim().toLowerCase()
  return email && email.includes('@') ? email : null
}

/**
 * A phone number as it is compared: separators dropped, and the international
 * "00" prefix written as "+". Nothing is guessed beyond that: a local
 * "0555 12 34 56" is not assumed to be "+213 555 12 34 56", because the same
 * local digits mean different people in different countries, and a wrong match
 * is worse than a missed one. Fewer than six digits is not a number.
 */
export function normalizePhone(value: string | null | undefined): string | null {
  let phone = (value ?? '').trim().replace(/[\s.\-()/]/g, '')
  if (phone.startsWith('00')) phone = `+${phone.slice(2)}`
  if (!/^\+?\d+$/.test(phone)) return null
  return phone.replace(/\D/g, '').length >= 6 ? phone : null
}

/** The fields of a unit that decide whether a lead may be given it. */
export interface LotForSelection {
  id: string
  programId: string
  status: string
}

export type LotSelectionResult =
  | { ok: true; programId: string | null }
  | { ok: false; error: 'not_found' | 'not_available' | 'wrong_program' | 'mixed_programs' }

/** At most this many units on one lead: an interest list, not the catalogue. */
export const MAX_INTERESTED_LOTS = 10

/**
 * Checks the units a lead was given against what the database says about them.
 * `found` is what was loaded for `requestedIds` within the workspace; a missing
 * one is a unit that does not exist or belongs to someone else. `keepIds` are
 * units the lead is already interested in: those stay allowed after they sell,
 * so editing an old lead does not fail on its own history.
 *
 * Returns the programme the units imply, so a lead given units but no project
 * still ends up with one.
 */
export function checkLotSelection(
  requestedIds: readonly string[],
  found: readonly LotForSelection[],
  programId: string | null,
  keepIds: readonly string[] = []
): LotSelectionResult {
  if (requestedIds.length === 0) return { ok: true, programId }
  const byId = new Map(found.map((lot) => [lot.id, lot]))
  for (const id of requestedIds) {
    const lot = byId.get(id)
    if (!lot) return { ok: false, error: 'not_found' }
    if (lot.status !== 'available' && !keepIds.includes(id)) return { ok: false, error: 'not_available' }
  }
  const programs = new Set(requestedIds.map((id) => byId.get(id)!.programId))
  if (programId) {
    return programs.size === 1 && programs.has(programId)
      ? { ok: true, programId }
      : { ok: false, error: 'wrong_program' }
  }
  if (programs.size > 1) return { ok: false, error: 'mixed_programs' }
  return { ok: true, programId: Array.from(programs)[0] }
}

/** Ids from a request body: strings only, deduplicated, capped. */
export function readLotIds(value: unknown): string[] | undefined {
  if (value === undefined) return undefined
  if (value === null) return []
  if (!Array.isArray(value)) return []
  const ids = Array.from(new Set(value.filter((v): v is string => typeof v === 'string' && v.length > 0 && v.length <= 100)))
  return ids
}
