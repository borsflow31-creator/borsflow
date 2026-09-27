import type { NextRequest } from 'next/server'

/**
 * Cron endpoint auth.
 *
 * Vercel Cron sends `Authorization: Bearer $CRON_SECRET`; manual invocations and
 * external schedulers in this project use `x-cron-secret`. Accepting both means
 * the scheduled run and a curl against the same URL are authorized the same way.
 */
export function isAuthorizedCron(request: NextRequest): boolean {
  const expected = process.env.CRON_SECRET
  if (!expected) return false

  if (request.headers.get('x-cron-secret') === expected) return true

  const authorization = request.headers.get('authorization')
  return authorization === `Bearer ${expected}`
}
