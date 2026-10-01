/**
 * Scheduler Worker
 *
 * Vercel Cron on the Hobby plan cannot run more than once a day, but this app's
 * jobs need minute, half-hour and hourly granularity. This Worker owns every
 * one of them and calls the app's existing cron endpoints over HTTP; nothing
 * about the app itself moves to Cloudflare. vercel.json carries no crons.
 */

export interface Env {
  /** Base URL of the deployed app, no trailing slash. Set in wrangler.toml. */
  APP_URL: string
  /** Must match CRON_SECRET in the app's environment. Set with `wrangler secret put`. */
  CRON_SECRET: string
}

/**
 * Order matters: automations materialize emails into the queue, so draining the
 * queue second means a step created this minute goes out this minute rather
 * than waiting for the next tick.
 */
const JOBS = [
  '/api/cron/process-automations',
  '/api/cron/process-email-queue',
] as const

/**
 * OAuth tokens are refreshed 45 minutes before they expire (see the route), so
 * a 30-minute check comfortably beats that window. The trigger fires every
 * minute (see wrangler.toml), so this only runs when the tick lands on minute
 * 0 or 30 - keeping a single cron expression instead of spending a second
 * trigger from the account's limit.
 */
const HALF_HOURLY_JOBS = ['/api/cron/refresh-tokens'] as const

/**
 * Housekeeping and syncing that only needs to run once an hour. Appended only
 * when the tick lands on minute 0, for the same reason as HALF_HOURLY_JOBS.
 */
const HOURLY_JOBS = [
  '/api/cron/expire-invitations',
  '/api/cron/mark-overdue',
  '/api/cron/sync-calendars',
  '/api/cron/notification-reminders',
] as const

interface JobResult {
  path: string
  ok: boolean
  status?: number
  body?: string
  error?: string
  durationMs: number
}

async function runJob(path: string, env: Env): Promise<JobResult> {
  const startedAt = Date.now()

  try {
    const response = await fetch(`${env.APP_URL}${path}`, {
      method: 'POST',
      headers: {
        // Every cron endpoint in the app accepts this form.
        Authorization: `Bearer ${env.CRON_SECRET}`,
        'Content-Type': 'application/json',
      },
    })

    // Bodies are small JSON status objects; truncate defensively anyway so a
    // stray HTML error page can't flood the logs.
    const body = (await response.text()).slice(0, 500)

    return {
      path,
      ok: response.ok,
      status: response.status,
      body,
      durationMs: Date.now() - startedAt,
    }
  } catch (error) {
    return {
      path,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
      durationMs: Date.now() - startedAt,
    }
  }
}

async function runAll(env: Env, jobs: readonly string[]): Promise<JobResult[]> {
  if (!env.APP_URL || !env.CRON_SECRET) {
    console.error('[cron-worker] APP_URL or CRON_SECRET is not configured; skipping run')
    return []
  }

  const results: JobResult[] = []

  // Sequential, so a slow queue drain cannot overlap with the next job and
  // blow past the subrequest budget on the free plan.
  for (const path of jobs) {
    const result = await runJob(path, env)
    results.push(result)

    if (result.ok) {
      console.log(`[cron-worker] ${path} ok in ${result.durationMs}ms ${result.body ?? ''}`)
    } else {
      // Logged, not thrown: one failing job must not stop the other, and the
      // next tick is only a minute away.
      console.error(
        `[cron-worker] ${path} failed in ${result.durationMs}ms`,
        result.status ?? '',
        result.error ?? result.body ?? ''
      )
    }
  }

  return results
}

export default {
  async scheduled(controller: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    const minute = new Date(controller.scheduledTime).getUTCMinutes()
    const isTopOfHour = minute === 0
    // minute 0 satisfies both checks; only add HALF_HOURLY_JOBS once, via the
    // hourly branch, so refresh-tokens isn't called twice on the hour.
    const jobs = isTopOfHour
      ? [...JOBS, ...HALF_HOURLY_JOBS, ...HOURLY_JOBS]
      : minute % 30 === 0
        ? [...JOBS, ...HALF_HOURLY_JOBS]
        : JOBS

    // waitUntil keeps the invocation alive until every job settles. Waiting on
    // fetch does not count toward CPU time, so this is fine on the free plan;
    // the ceiling is the 15 min wall clock for a cron invocation.
    ctx.waitUntil(runAll(env, jobs))
  },

  /**
   * Manual trigger, for verifying the wiring without waiting for a tick.
   * The Worker URL is public, so it is gated on the same secret.
   */
  async fetch(request: Request, env: Env): Promise<Response> {
    const authorization = request.headers.get('authorization')

    if (!env.CRON_SECRET || authorization !== `Bearer ${env.CRON_SECRET}`) {
      return new Response('Unauthorized', { status: 401 })
    }

    // A manual run exercises every job, half-hourly and hourly ones included.
    const results = await runAll(env, [...JOBS, ...HALF_HOURLY_JOBS, ...HOURLY_JOBS])

    return Response.json({
      ran: results.length,
      results,
      timestamp: new Date().toISOString(),
    })
  },
}
