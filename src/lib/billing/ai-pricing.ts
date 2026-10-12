/**
 * How many AI credits a model call costs, from the tokens it used.
 *
 * A credit is a fixed slice of real model spend (`CREDIT_USD`), so a long
 * document costs more than "fix this typo" and the 70B model costs more than the
 * 8B one per token. Plan allowances in `plans.ts` are counted in these credits.
 */

export interface TokenUsage {
  inputTokens: number
  outputTokens: number
}

interface ModelPrice {
  /** USD per million input (prompt) tokens. */
  inputPerM: number
  /** USD per million output (completion) tokens. */
  outputPerM: number
}

/**
 * OpenRouter's listed prices (USD per million tokens) for the models in
 * `@/lib/ai/models`, read from https://openrouter.ai/api/v1/models on 2026-10-10. The others stay for AI_*_MODEL overrides.
 * OpenRouter lists the cheapest provider's rate; update this table if the
 * account's actual spend differs.
 */
export const MODEL_PRICING: Record<string, ModelPrice> = {
  'google/gemini-2.5-flash-lite': { inputPerM: 0.1, outputPerM: 0.4 },
  // A step up in instruction-following, and six times the price of lite.
  'google/gemini-2.5-flash': { inputPerM: 0.3, outputPerM: 2.5 },
  'meta-llama/llama-3.1-8b-instruct': { inputPerM: 0.05, outputPerM: 0.08 },
  'meta-llama/llama-3.3-70b-instruct': { inputPerM: 0.22, outputPerM: 0.5 },
  'openai/gpt-oss-20b': { inputPerM: 0.018, outputPerM: 0.09 },
}

/** 1 credit = $0.001 of model spend. The single knob for what a credit is worth. */
export const CREDIT_USD = 0.001

/** No request is free, however small. */
export const MIN_CREDITS_PER_REQUEST = 1

// Prices are converted to integer micro-dollars per million tokens so the
// arithmetic below never accumulates float error.
const MICRO = 1_000_000
const CREDIT_MICRO_USD = Math.round(CREDIT_USD * MICRO)

function priceFor(model: string): ModelPrice {
  const known = MODEL_PRICING[model]
  if (known) return known
  // An unknown model (e.g. an AI_*_MODEL override) is billed at the most
  // expensive known rate, so a misconfiguration can't make AI free.
  return Object.values(MODEL_PRICING).reduce((a, b) =>
    b.inputPerM + b.outputPerM > a.inputPerM + a.outputPerM ? b : a
  )
}

/** Credits for one or more calls' worth of tokens on `model`. */
export function creditsFor(model: string, usage: TokenUsage): number {
  const price = priceFor(model)
  const inputMicroPerM = Math.round(price.inputPerM * MICRO)
  const outputMicroPerM = Math.round(price.outputPerM * MICRO)

  // micro-dollars * tokens / 1M tokens; stays well inside Number's integer range
  // for any realistic request.
  const costMicroUsd =
    (Math.max(0, usage.inputTokens) * inputMicroPerM +
      Math.max(0, usage.outputTokens) * outputMicroPerM) /
    MICRO

  return Math.max(MIN_CREDITS_PER_REQUEST, Math.ceil(costMicroUsd / CREDIT_MICRO_USD))
}

/**
 * Rough token count for text: about 4 characters per token for English. Used to
 * size reservations and as the fallback when a call ends without the provider reporting
 * usage (an abort or a stream error).
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)
}

/** Token estimate for a chat message list, including a little per-message overhead. */
export function estimateMessageTokens(messages: Array<{ content?: unknown }>): number {
  let total = 0
  for (const message of messages) {
    const content = typeof message.content === 'string'
      ? message.content
      : JSON.stringify(message.content ?? '')
    total += estimateTokens(content) + 4
  }
  return total
}
