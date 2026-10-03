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
 * Groq's last published on-demand list prices. The console now lists these
 * models as "Contact Sales", so update this table from the Groq invoice or
 * contract when the real rate is known.
 */
export const MODEL_PRICING: Record<string, ModelPrice> = {
  'llama-3.1-8b-instant': { inputPerM: 0.05, outputPerM: 0.08 },
  'llama-3.3-70b-versatile': { inputPerM: 0.59, outputPerM: 0.79 },
  'openai/gpt-oss-20b': { inputPerM: 0.075, outputPerM: 0.3 },
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
  // An unknown model (e.g. a GROQ_*_MODEL override) is billed at the most
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
 * size reservations and as the fallback when a call ends without Groq reporting
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
