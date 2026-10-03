/**
 * Which Groq model each kind of AI work uses. Overridable per environment; an
 * override missing from `MODEL_PRICING` is billed at the most expensive rate.
 */

/** The workspace assistant: a reasoning model with reliable multi-step tool calling. */
export const AGENT_MODEL = process.env.GROQ_AGENT_MODEL || 'openai/gpt-oss-20b'

/** One-shot text edits (rewrite, summarize, short lists): the small model is enough. */
export const UTILITY_MODEL = process.env.GROQ_UTILITY_MODEL || 'llama-3.1-8b-instant'

/** Structured generation where quality matters (product and email copy). */
export const QUALITY_MODEL = process.env.GROQ_QUALITY_MODEL || 'llama-3.3-70b-versatile'

/**
 * Extra request options for reasoning models (gpt-oss). Their hidden reasoning
 * counts against max_completion_tokens, so keep it short and don't stream it.
 * Other models reject these options, so they get none.
 */
export function reasoningOptions(model: string) {
  return model.startsWith('openai/gpt-oss')
    ? { reasoning_effort: 'low' as const, include_reasoning: false }
    : {}
}
