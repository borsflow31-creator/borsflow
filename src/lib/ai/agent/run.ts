import type Groq from 'groq-sdk'
import { getGroq } from '@/lib/groq'
import { canAffordAnotherRound, settleAiCredits, type AiReservation } from '@/lib/billing/ai-credits'
import { estimateMessageTokens, estimateTokens, type TokenUsage } from '@/lib/billing/ai-pricing'
import { toTokenUsage } from '@/lib/ai/billed-completion'
import { reasoningOptions } from '@/lib/ai/models'
import { runTool, toolDefinitions, toolLabel, type ToolContext } from './tools'

/**
 * The assistant's tool loop. Each round is one streamed model call with the
 * tools available: text is forwarded as it arrives, tool calls are collected,
 * run in parallel, and fed back for the next round. The loop ends when a round
 * produces no tool calls, and a final round with tools disabled guarantees an
 * answer. Usage from every round is billed once, at the end, whatever happens.
 */

type ChatMessage = Groq.Chat.Completions.ChatCompletionMessageParam

export type AgentEvent =
  | { t: 'text'; v: string }
  | { t: 'tool'; id: string; name: string; label: string }
  | { t: 'tool_done'; id: string; name: string; ok: boolean; link?: { label: string; url: string } }
  | { t: 'error'; message: string }
  | { t: 'done'; credits: number }

/** Tool rounds before the model is made to answer with what it has. */
export const MAX_TOOL_ROUNDS = 5
export const MAX_OUTPUT_TOKENS = 1024

interface PendingCall {
  id: string
  name: string
  args: string
}

function isToolUseFailure(error: unknown): boolean {
  return String((error as any)?.message ?? error).includes('tool_use_failed')
}

export async function runAgent(params: {
  ctx: ToolContext
  reservation: AiReservation
  /** System prompt plus trimmed history, ending with the user's message. */
  messages: ChatMessage[]
  send: (event: AgentEvent) => void
  signal: AbortSignal
}): Promise<void> {
  const { ctx, reservation, send, signal } = params
  const conversation: ChatMessage[] = [...params.messages]
  const tools = toolDefinitions(ctx.role)
  const usage: TokenUsage = { inputTokens: 0, outputTokens: 0 }
  let status: 'ok' | 'error' | 'aborted' = 'ok'
  let emittedText = false
  // Llama occasionally emits a malformed tool call, which Groq rejects with
  // `tool_use_failed`. One retry with tools off still gets the user an answer.
  let toolsDisabled = false

  try {
    for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
      if (round > 0 && !(await canAffordAnotherRound(reservation, usage))) {
        send({
          t: 'text',
          v: `${emittedText ? '\n\n' : ''}_Your workspace has used all of its AI credits for this month, so I stopped before finishing._`,
        })
        break
      }

      const lastRound = round === MAX_TOOL_ROUNDS || toolsDisabled
      let text = ''
      let reported: TokenUsage | null = null
      const calls = new Map<number, PendingCall>()

      try {
        const stream = await getGroq().chat.completions.create(
          {
            model: reservation.model,
            messages: conversation,
            tools,
            tool_choice: lastRound ? 'none' : 'auto',
            stream: true,
            temperature: 0.3,
            max_completion_tokens: MAX_OUTPUT_TOKENS,
            ...reasoningOptions(reservation.model),
          },
          { signal }
        )

        for await (const chunk of stream) {
          const delta = chunk.choices[0]?.delta
          if (delta?.content) {
            // Separate this round's text from an earlier round's.
            const piece = !text && emittedText ? `\n\n${delta.content}` : delta.content
            text += delta.content
            emittedText = true
            send({ t: 'text', v: piece })
          }
          for (const call of delta?.tool_calls ?? []) {
            const pending = calls.get(call.index) ?? { id: '', name: '', args: '' }
            if (call.id) pending.id = call.id
            if (call.function?.name) pending.name += call.function.name
            if (call.function?.arguments) pending.args += call.function.arguments
            calls.set(call.index, pending)
          }
          reported = toTokenUsage(chunk.x_groq?.usage) ?? reported
        }
      } catch (error) {
        const partial = [...calls.values()].map((call) => call.args).join('')
        addUsage(usage, reported ?? estimateRound(conversation, text + partial))
        if (!signal.aborted && isToolUseFailure(error) && !toolsDisabled) {
          toolsDisabled = true
          continue
        }
        throw error
      }

      const pending = [...calls.values()].filter((call) => call.name)
      addUsage(usage, reported ?? estimateRound(conversation, text + pending.map((call) => call.args).join('')))

      if (pending.length === 0 || lastRound) break

      pending.forEach((call, i) => {
        if (!call.id) call.id = `call_${round}_${i}`
      })
      conversation.push({
        role: 'assistant',
        content: text || null,
        tool_calls: pending.map((call) => ({
          id: call.id,
          type: 'function' as const,
          function: { name: call.name, arguments: call.args || '{}' },
        })),
      })

      for (const call of pending) {
        send({ t: 'tool', id: call.id, name: call.name, label: toolLabel(call.name) })
      }
      const results = await Promise.all(pending.map((call) => runTool(ctx, call.name, call.args)))
      pending.forEach((call, i) => {
        const result = results[i]
        conversation.push({ role: 'tool', tool_call_id: call.id, content: result.content })
        send({ t: 'tool_done', id: call.id, name: call.name, ok: result.ok, link: result.link })
      })
    }
  } catch (error) {
    status = signal.aborted ? 'aborted' : 'error'
    if (status === 'error') {
      console.error('AI agent failed:', error)
      send({
        t: 'error',
        message: emittedText
          ? 'The answer was cut off because the AI service stopped responding. Try again.'
          : 'The AI service could not answer. Try again in a moment.',
      })
    }
  } finally {
    const produced = usage.inputTokens + usage.outputTokens > 0
    const credits = await settleAiCredits(reservation, produced ? usage : null, status)
    send({ t: 'done', credits })
  }
}

function addUsage(total: TokenUsage, round: TokenUsage) {
  total.inputTokens += round.inputTokens
  total.outputTokens += round.outputTokens
}

/** Fallback when a round ends without Groq's usage report. */
function estimateRound(conversation: ChatMessage[], output: string): TokenUsage {
  if (!output) return { inputTokens: 0, outputTokens: 0 }
  return { inputTokens: estimateMessageTokens(conversation), outputTokens: estimateTokens(output) }
}
