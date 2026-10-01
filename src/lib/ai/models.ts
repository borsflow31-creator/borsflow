/**
 * Which Groq model each kind of AI work uses. Overridable per environment; an
 * override missing from `MODEL_PRICING` is billed at the most expensive rate.
 */

/** The workspace assistant: multi-step tool calling needs the larger model. */
export const AGENT_MODEL = process.env.GROQ_AGENT_MODEL || 'llama-3.3-70b-versatile'

/** One-shot text edits (rewrite, summarize, short lists): the small model is enough. */
export const UTILITY_MODEL = process.env.GROQ_UTILITY_MODEL || 'llama-3.1-8b-instant'

/** Structured generation where quality matters (product and email copy). */
export const QUALITY_MODEL = process.env.GROQ_QUALITY_MODEL || 'llama-3.3-70b-versatile'
