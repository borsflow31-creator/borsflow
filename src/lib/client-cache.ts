/**
 * Tiny client-side JSON cache shared across page navigations.
 *
 * Every page wraps itself in <AppShell>, so the shell remounts on each
 * navigation; without this it re-fetched the workspace list and the (heavy)
 * workspace detail on every click. Entries live at module level, so they
 * survive navigation until a full reload, and concurrent requests for the same
 * URL share one fetch.
 */

type Entry = { data: unknown; at: number }

const store = new Map<string, Entry>()
const inflight = new Map<string, Promise<unknown>>()

export class CachedFetchError extends Error {
  constructor(public status: number, message: string) {
    super(message)
  }
}

/** Fresh cached JSON for `url`, or fetch it. Non-OK responses throw and are not cached. */
export async function cachedJson<T = any>(url: string, { ttlMs = 60_000 }: { ttlMs?: number } = {}): Promise<T> {
  const hit = store.get(url)
  if (hit && Date.now() - hit.at < ttlMs) return hit.data as T

  const pending = inflight.get(url)
  if (pending) return pending as Promise<T>

  const request = (async () => {
    try {
      const res = await fetch(url)
      if (!res.ok) throw new CachedFetchError(res.status, `Request failed: ${res.status}`)
      const data = await res.json()
      store.set(url, { data, at: Date.now() })
      return data
    } finally {
      inflight.delete(url)
    }
  })()
  inflight.set(url, request)
  return request as Promise<T>
}

/** Synchronous read of whatever is cached (fresh or not), for rendering without a flash. */
export function peekCached<T = any>(url: string): T | undefined {
  return store.get(url)?.data as T | undefined
}

/** Drop cached entries whose URL starts with `prefix` (call after a write). */
export function invalidateCached(prefix: string): void {
  for (const key of Array.from(store.keys())) {
    if (key.startsWith(prefix)) store.delete(key)
  }
}
