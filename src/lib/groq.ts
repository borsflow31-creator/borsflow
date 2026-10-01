import Groq from 'groq-sdk'

/**
 * Lazily-constructed Groq client.
 *
 * The SDK constructor throws when the API key resolves to undefined, so
 * building the client at module scope made *importing* an AI route throw on any
 * environment without GROQ_API_KEY set. Next.js imports every route during the
 * build to collect its metadata, so a deploy without the key failed with
 * "Failed to collect page data for /api/ai/chat" long before a request existed.
 *
 * Every caller already checks the env var and returns a 500 when it is missing,
 * so deferring construction to the first request preserves that behaviour while
 * keeping the module safe to import.
 */
let client: Groq | null = null

export function getGroq(): Groq {
  if (!client) {
    client = new Groq({
      apiKey: process.env.GROQ_API_KEY,
      // The SDK retries 408/409/429/5xx with backoff. Two retries rides out
      // Groq's short rate-limit blips without making a dead upstream hang.
      maxRetries: 2,
      timeout: 60_000,
    })
  }
  return client
}

export function isGroqConfigured(): boolean {
  return !!process.env.GROQ_API_KEY
}

/** Return type of `create()` - the stream/non-stream union, per the call's options. */
export type GroqCompletion = Awaited<ReturnType<Groq['chat']['completions']['create']>>
