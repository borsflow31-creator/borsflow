import OpenAI from 'openai'

/**
 * The AI provider: OpenRouter, through the OpenAI SDK pointed at its
 * OpenAI-compatible endpoint (https://openrouter.ai/docs/quickstart).
 *
 * The client is built on first use, not at import: the SDK throws when the key
 * is missing, and Next.js imports every route during the build, so a module-level
 * client would fail a deploy that has no key yet. Every caller checks
 * `isAiConfigured()` first and answers with `AI_NOT_CONFIGURED` instead.
 */

export type ChatMessage = OpenAI.Chat.Completions.ChatCompletionMessageParam
export type ChatTool = OpenAI.Chat.Completions.ChatCompletionTool
export type ChatCompletion = OpenAI.Chat.Completions.ChatCompletion
export type ChatCompletionChunk = OpenAI.Chat.Completions.ChatCompletionChunk

export const AI_NOT_CONFIGURED = 'OPENROUTER_API_KEY is not configured'

let client: OpenAI | null = null

export function getAi(): OpenAI {
  if (!client) {
    client = new OpenAI({
      baseURL: 'https://openrouter.ai/api/v1',
      apiKey: process.env.OPENROUTER_API_KEY,
      // Shown on OpenRouter's dashboard and rankings for this app.
      defaultHeaders: {
        'HTTP-Referer': process.env.NEXTAUTH_URL || 'https://borsflow.app',
        'X-OpenRouter-Title': 'BorsFlow',
      },
      // The SDK retries 408/409/429/5xx with backoff: enough to ride out a
      // provider blip without making a dead upstream hang.
      maxRetries: 2,
      timeout: 60_000,
    })
  }
  return client
}

export function isAiConfigured(): boolean {
  return !!process.env.OPENROUTER_API_KEY
}

/**
 * A message for the person using the app when the provider refused the call for
 * a reason retrying won't fix: the key, the account's credit, or a bad model id.
 * Null for transient failures, which keep the generic "try again" message.
 */
export function providerErrorMessage(error: unknown): string | null {
  const status = (error as { status?: number })?.status
  if (status === 401 || status === 403) return 'The AI service is not set up correctly (invalid API key). Ask an admin to check OPENROUTER_API_KEY.'
  if (status === 402) return 'The AI service account has run out of credit. Ask an admin to top up OpenRouter.'
  if (status === 404) return 'The AI model configured for this feature is not available. Ask an admin to check the model setting.'
  return null
}
