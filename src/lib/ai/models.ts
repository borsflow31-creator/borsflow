/**
 * Which OpenRouter model each kind of AI work uses. Overridable per environment;
 * an override missing from `MODEL_PRICING` is billed at the most expensive rate.
 */

/** Gemini 2.5 Flash-Lite by default: fast, cheap, tool calling and JSON output. */
const DEFAULT_MODEL = 'google/gemini-2.5-flash-lite'

/** The workspace assistant: needs reliable multi-step tool calling. */
export const AGENT_MODEL = process.env.AI_AGENT_MODEL || DEFAULT_MODEL

/** One-shot text edits (rewrite, summarize, short lists): the small model is enough. */
export const UTILITY_MODEL = process.env.AI_UTILITY_MODEL || DEFAULT_MODEL

/** Structured generation where quality matters (product and email copy). */
export const QUALITY_MODEL = process.env.AI_QUALITY_MODEL || DEFAULT_MODEL

/**
 * Extra request options for reasoning models (gpt-oss). Their hidden reasoning
 * counts against max_completion_tokens, so keep it short and leave it out of the
 * response. Other models get none. OpenRouter's `reasoning` parameter:
 * https://openrouter.ai/docs/use-cases/reasoning-tokens
 */
export function reasoningOptions(model: string): Record<string, unknown> {
  return model.startsWith('openai/gpt-oss') ? { reasoning: { effort: 'low', exclude: true } } : {}
}
