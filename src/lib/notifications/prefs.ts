import { NOTIFICATION_CATEGORIES, type NotificationCategory } from './types';

export interface CategoryPref {
  inApp: boolean;
  email: boolean;
}

export type NotificationPrefs = Record<NotificationCategory, CategoryPref>;

/**
 * In-app is on for every category by default. Email is on only for the
 * categories worth someone's inbox — sales and meetings — off for team and
 * tasks, which are chattier and usually checked in-app.
 */
export const DEFAULT_PREFS: NotificationPrefs = {
  team: { inApp: true, email: false },
  sales: { inApp: true, email: true },
  meetings: { inApp: true, email: true },
  tasks: { inApp: true, email: false },
};

/** Loosely-typed shape read back from `User.notificationPrefs` (a Prisma `Json?`). */
type StoredPrefs = Partial<Record<string, Partial<CategoryPref>>>;

/**
 * Merge stored per-category overrides over the defaults. Unknown keys and
 * malformed values are dropped rather than trusted, since this JSON blob is
 * round-tripped through a user-facing API.
 */
export function resolvePrefs(stored: unknown): NotificationPrefs {
  const result: NotificationPrefs = {
    team: { ...DEFAULT_PREFS.team },
    sales: { ...DEFAULT_PREFS.sales },
    meetings: { ...DEFAULT_PREFS.meetings },
    tasks: { ...DEFAULT_PREFS.tasks },
  };

  if (!stored || typeof stored !== 'object') return result;
  const raw = stored as StoredPrefs;

  for (const category of NOTIFICATION_CATEGORIES) {
    const override = raw[category];
    if (!override || typeof override !== 'object') continue;
    if (typeof override.inApp === 'boolean') result[category].inApp = override.inApp;
    if (typeof override.email === 'boolean') result[category].email = override.email;
  }

  return result;
}

/**
 * Validates a client-supplied partial prefs payload before it's merged onto the
 * user's current prefs. Only the fields actually sent are returned — the caller
 * merges them onto `resolvePrefs(user.notificationPrefs)`, so a partial update
 * (e.g. `{ sales: { email: false } }`) never resets a category's other field
 * back to its default. Returns `null` if the shape is invalid.
 */
export function parsePrefsInput(input: unknown): Partial<Record<NotificationCategory, Partial<CategoryPref>>> | null {
  if (!input || typeof input !== 'object') return null;
  const raw = input as StoredPrefs;
  const result: Partial<Record<NotificationCategory, Partial<CategoryPref>>> = {};

  for (const category of NOTIFICATION_CATEGORIES) {
    const override = raw[category];
    if (override === undefined) continue;
    if (!override || typeof override !== 'object') return null;
    if (override.inApp !== undefined && typeof override.inApp !== 'boolean') return null;
    if (override.email !== undefined && typeof override.email !== 'boolean') return null;
    result[category] = { ...override };
  }

  return result;
}
