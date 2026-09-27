// Server-only. Never import this from a 'use client' file: it reads ABLY_API_KEY.
import Ably from 'ably'

let _ably: Ably.Rest | null = null

export function getAblyRest(): Ably.Rest {
  if (!_ably) {
    if (!process.env.ABLY_API_KEY) {
      throw new Error('ABLY_API_KEY is not set')
    }
    _ably = new Ably.Rest({
      key: process.env.ABLY_API_KEY,
      // Sign token requests with Ably's clock rather than ours: a drifted server clock
      // otherwise produces opaque 40104 timestamp errors.
      queryTime: true,
    })
  }
  return _ably
}
