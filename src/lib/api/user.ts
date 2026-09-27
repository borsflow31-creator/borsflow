import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { normalizeEmail } from '@/lib/email/normalize'

/**
 * Look a user up by email, ignoring case.
 *
 * `User.email` was historically stored exactly as typed at sign-up, so
 * `Bob@x.com` and `bob@x.com` could both exist and an exact-match lookup would
 * miss a user who typed their address differently at login. Matching
 * insensitively resolves the user whether or not the normalisation migration
 * has run yet, which is what makes deploying the code before the migration
 * safe.
 *
 * If case-variant duplicates already exist, the oldest account wins - the same
 * survivor rule the migration's README uses when merging them.
 *
 * Performance: `mode: 'insensitive'` becomes ILIKE, which cannot use the
 * unique index on `email`. That is a scan of the User table - irrelevant at
 * this size. If it ever matters, switch to `lower("email") = $1` with an
 * expression index.
 */
export async function findUserByEmail<T extends Prisma.UserDefaultArgs = {}>(
  email: string | null | undefined,
  args?: Prisma.SelectSubset<T, Prisma.UserDefaultArgs>
): Promise<Prisma.UserGetPayload<T> | null> {
  const normalized = normalizeEmail(email)
  if (!normalized) return null

  const user = await prisma.user.findFirst({
    ...((args ?? {}) as Prisma.UserDefaultArgs),
    where: { email: { equals: normalized, mode: 'insensitive' } },
    orderBy: { createdAt: 'asc' },
  })

  return user as Prisma.UserGetPayload<T> | null
}
