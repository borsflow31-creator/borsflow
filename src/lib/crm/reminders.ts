/**
 * When a buyer is reminded about a call for funds.
 *
 * Five steps around the due date: a week before, on the day, then three, seven and
 * fourteen days late. Pure, so the cadence is proved without a clock or a database,
 * and so the job that runs it every hour can be re-run (or missed for a day) without
 * writing to anyone twice or burying them in a backlog.
 */

export const REMINDER_STEPS = ['before7', 'due', 'late3', 'late7', 'late14'] as const
export type ReminderStep = (typeof REMINDER_STEPS)[number]

/** How many days from the due date each step becomes current. Negative is before. */
const STEP_DAY: Record<ReminderStep, number> = {
  before7: -7,
  due: 0,
  late3: 3,
  late7: 7,
  late14: 14,
}

const DAY_MS = 24 * 60 * 60 * 1000
const startOfUtcDay = (d: Date) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())

/** Whole calendar days `now` is past `dueAt` (negative before it), in UTC. */
export function daysPastDue(dueAt: Date, now: Date): number {
  return Math.round((startOfUtcDay(now) - startOfUtcDay(dueAt)) / DAY_MS)
}

/** The steps that are late, as opposed to the heads-up and the due-day notice. */
export const LATE_STEPS: readonly ReminderStep[] = ['late3', 'late7', 'late14']

/**
 * The reminder to send now, or null if there is nothing to send.
 *
 * Only the latest step that has been reached is ever eligible. If the job was down
 * for a week, the buyer gets the one reminder that is true today, not a reminder
 * for every step they slept through; and once that step is recorded as sent, nothing
 * further goes until the next step is reached. That is also what makes a double run
 * harmless: the second finds its step already sent.
 */
export function reminderStepFor(
  dueAt: Date,
  now: Date,
  alreadySent: Iterable<string> = []
): ReminderStep | null {
  const days = daysPastDue(dueAt, now)
  const sent = new Set(alreadySent)

  let latest: ReminderStep | null = null
  for (const step of REMINDER_STEPS) {
    if (days >= STEP_DAY[step]) latest = step
  }
  if (!latest) return null
  return sent.has(latest) ? null : latest
}
