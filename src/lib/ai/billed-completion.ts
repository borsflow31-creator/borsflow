import type Groq from 'groq-sdk'
import { getGroq } from '@/lib/groq'
import { settleAiCredits, type AiReservation } from '@/lib/billing/ai-credits'
import { estimateMessageTokens, estimateTokens, type TokenUsage } from '@/lib/billing/ai-pricing'

/**
 * One-shot model calls that always settle their credit reservation, whatever
 * happens: success, upstream error, or the client going away mid-stream.
 *
 * The agent has its own multi-round loop (`@/lib/ai/agent/run`); everything else
 * (editor edits, template/product/email generation) goes through here.
 */

type ChatMessage = Groq.Chat.Completions.ChatCompletionMessageParam

export interface CompletionOptions {
  reservation: AiReservation
  messages: ChatMessage[]
  maxTokens: number
  temperature?: number
  /** Ask Groq for a JSON object. The prompt must also say "JSON". */
  json?: boolean
  /** Aborts the upstream call, e.g. the incoming request's signal. */
  signal?: AbortSignal
}

/** Tokens Groq reported, or null when it reported none. */
export function toTokenUsage(
  usage: { prompt_tokens?: number; completion_tokens?: number } | null | undefined
): TokenUsage | null {
  if (!usage) return null
  return { inputTokens: usage.prompt_tokens ?? 0, outputTokens: usage.completion_tokens ?? 0 }
}

/**
 * What to bill when a call ended without usage figures: the prompt was sent, so
 * count it, plus whatever output had already streamed. Zero output and no
 * response at all is treated by the caller as "nothing happened".
 */
export function estimatedUsage(messages: ChatMessage[], outputText: string): TokenUsage {
  return { inputTokens: estimateMessageTokens(messages), outputTokens: estimateTokens(outputText) }
}

/** An AbortController that also fires when `parent` does. */
export function linkedAbortController(parent?: AbortSignal): AbortController {
  const controller = new AbortController()
  if (parent) {
    if (parent.aborted) controller.abort()
    else parent.addEventListener('abort', () => controller.abort(), { once: true })
  }
  return controller
}

function requestBody(options: CompletionOptions) {
  return {
    model: options.reservation.model,
    messages: options.messages,
    max_completion_tokens: options.maxTokens,
    ...(options.temperature !== undefined ? { temperature: options.temperature } : {}),
    ...(options.json ? { response_format: { type: 'json_object' as const } } : {}),
  }
}

/**
 * Non-streaming call. Returns the text and the credits charged. Throws when the
 * model call fails; the reservation is refunded before the error propagates.
 */
export async function completeBilled(
  options: CompletionOptions
): Promise<{ text: string; credits: number }> {
  let completion: Groq.Chat.Completions.ChatCompletion
  try {
    completion = await getGroq().chat.completions.create(
      { ...requestBody(options), stream: false },
      { signal: options.signal }
    )
  } catch (error) {
    await settleAiCredits(options.reservation, null, 'error')
    throw error
  }

  const text = completion.choices[0]?.message?.content ?? ''
  const usage = toTokenUsage(completion.usage) ?? estimatedUsage(options.messages, text)
  const credits = await settleAiCredits(options.reservation, usage, 'ok')
  return { text, credits }
}

/**
 * Streaming call, returned as a plain-text byte stream. Throws (after a full
 * refund) if the call can't be started, so the route can still answer with an
 * error status. Once streaming, errors and client disconnects end the stream and
 * bill what was generated so far.
 */
export async function streamBilled(options: CompletionOptions): Promise<ReadableStream<Uint8Array>> {
  const abort = linkedAbortController(options.signal)

  let stream: AsyncIterable<Groq.Chat.Completions.ChatCompletionChunk>
  try {
    stream = await getGroq().chat.completions.create(
      { ...requestBody(options), stream: true },
      { signal: abort.signal }
    )
  } catch (error) {
    await settleAiCredits(options.reservation, null, 'error')
    throw error
  }

  const encoder = new TextEncoder()
  let output = ''
  let reported: TokenUsage | null = null

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      let status: 'ok' | 'error' | 'aborted' = 'ok'
      try {
        for await (const chunk of stream) {
          const text = chunk.choices[0]?.delta?.content ?? ''
          if (text) {
            output += text
            controller.enqueue(encoder.encode(text))
          }
          reported = toTokenUsage(chunk.x_groq?.usage) ?? reported
        }
      } catch (error) {
        status = abort.signal.aborted ? 'aborted' : 'error'
        if (status === 'error') console.error('AI stream failed:', error)
      } finally {
        // No usage report and no output means the user got nothing: refund.
        await settleAiCredits(
          options.reservation,
          reported ?? (output ? estimatedUsage(options.messages, output) : null),
          status
        )
        try {
          controller.close()
        } catch {
          // Already closed because the client cancelled.
        }
      }
    },
    cancel() {
      abort.abort()
    },
  })
}
