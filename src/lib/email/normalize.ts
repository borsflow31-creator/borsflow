/**
 * Canonical form for an email address that identifies a user: trimmed and
 * lowercased. Browser-safe (no server imports).
 *
 * Every place that WRITES a user's email, or a value that is later matched
 * against it (VerificationToken.identifier, Invitation.email), should pass it
 * through here. Reads go through findUserByEmail in src/lib/api/user.ts, which
 * also tolerates rows written before this rule existed.
 */
export function normalizeEmail(email: string | null | undefined): string {
  return (email ?? '').trim().toLowerCase()
}
