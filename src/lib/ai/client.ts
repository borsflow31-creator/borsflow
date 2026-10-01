import { errorFrom } from '@/lib/products'

/**
 * Browser helpers for the AI routes. Every caller reads streams through these
 * so multi-byte characters split across chunks decode correctly, and so server
 * error messages (out of credits, rate limited, no access) reach the user.
 */

export class AiRequestError extends Error {
  constructor(message: string, public status: number) {
    super(message)
    this.name = 'AiRequestError'
  }
}

export type AiScope = { workspaceId: string } | { pageId: string }

export interface CompleteRequest {
  /** What to do, e.g. "Rewrite this text in a formal tone." */
  prompt: string
  /** The text to work on, sent separately from the instruction. */
  text?: string
  /** Return one JSON object; describe its shape in `prompt`. */
  json?: boolean
  maxTokens?: number
}

async function readText(response: Response, onChunk?: (text: string) => void): Promise<string> {
  if (!response.body) return ''
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let result = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    const chunk = decoder.decode(value, { stream: true })
    if (chunk) {
      result += chunk
      onChunk?.(chunk)
    }
  }
  const tail = decoder.decode()
  if (tail) {
    result += tail
    onChunk?.(tail)
  }
  return result
}

/**
 * Run a one-shot task on /api/ai/complete and return the whole result.
 * `onChunk` receives text as it streams. Throws AiRequestError with the
 * server's message on failure.
 */
export async function aiComplete(
  scope: AiScope,
  request: CompleteRequest,
  onChunk?: (text: string) => void
): Promise<string> {
  const response = await fetch('/api/ai/complete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...scope, ...request }),
  })
  if (!response.ok) {
    throw new AiRequestError(await errorFrom(response, 'The AI request failed. Try again.'), response.status)
  }
  return readText(response, onChunk)
}

/** Parse the JSON object an `aiComplete({ json: true })` call returned. */
export function parseAiJson<T = unknown>(raw: string): T {
  try {
    return JSON.parse(raw) as T
  } catch {
    // Some models still wrap JSON in prose or fences; take the outermost object.
    const start = raw.indexOf('{')
    const end = raw.lastIndexOf('}')
    if (start === -1 || end <= start) throw new AiRequestError('The AI returned an unreadable answer. Try again.', 502)
    return JSON.parse(raw.slice(start, end + 1)) as T
  }
}

/** A user-facing message for any error thrown while calling the AI. */
export function aiErrorMessage(error: unknown, fallback: string): string {
  return error instanceof AiRequestError ? error.message : fallback
}

// ─── Assistant (agent) stream ────────────────────────────────────────────────

export type AgentStreamEvent =
  | { t: 'text'; v: string }
  | { t: 'tool'; id: string; name: string; label: string }
  | { t: 'tool_done'; id: string; name: string; ok: boolean; link?: { label: string; url: string } }
  | { t: 'error'; message: string }
  | { t: 'done'; credits: number }

/** Read the NDJSON event stream from /api/ai/chat, calling `onEvent` per event. */
export async function readAgentStream(
  response: Response,
  onEvent: (event: AgentStreamEvent) => void
): Promise<void> {
  let buffer = ''
  const flushLines = (final: boolean) => {
    const lines = buffer.split('\n')
    buffer = final ? '' : lines.pop() ?? ''
    for (const line of lines) {
      if (!line.trim()) continue
      try {
        onEvent(JSON.parse(line) as AgentStreamEvent)
      } catch {
        // A malformed line is skipped rather than ending the reply.
      }
    }
  }
  await readText(response, (chunk) => {
    buffer += chunk
    flushLines(false)
  })
  flushLines(true)
}
