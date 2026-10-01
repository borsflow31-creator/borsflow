import { NextRequest } from 'next/server'
import type Groq from 'groq-sdk'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { requireWorkspaceAccess, getWorkspaceRole } from '@/lib/api/workspace'
import { reserveAiCredits } from '@/lib/billing/ai-credits'
import { estimateMessageTokens, estimateTokens } from '@/lib/billing/ai-pricing'
import { linkedAbortController } from '@/lib/ai/billed-completion'
import { AGENT_MODEL } from '@/lib/ai/models'
import { buildSystemPrompt, safeTimeZone } from '@/lib/ai/agent/prompt'
import { MAX_OUTPUT_TOKENS, runAgent, type AgentEvent } from '@/lib/ai/agent/run'
import { toolDefinitions } from '@/lib/ai/agent/tools'

/**
 * The workspace assistant. Streams newline-delimited JSON events (see
 * `AgentEvent`): text deltas, tool progress, and a final `done` with the
 * credits the reply cost.
 *
 * One-shot editor edits (rewrite, outline, subject lines) use /api/ai/complete.
 */

const MAX_MESSAGES = 50
const MAX_MESSAGE_CHARS = 8000
const MAX_CONTEXT_CHARS = 8000
/** Conversation history kept per request, in estimated tokens. */
const HISTORY_TOKEN_BUDGET = 6000

type ChatMessage = Groq.Chat.Completions.ChatCompletionMessageParam

const jsonError = (error: string | undefined, status: number | undefined) =>
    new Response(JSON.stringify({ error: error ?? 'Request failed' }), {
        status: status ?? 500,
        headers: { 'Content-Type': 'application/json' },
    })

/**
 * Only plain user/assistant turns are accepted from the client: a client-sent
 * `system` or `tool` message could override the assistant's instructions.
 */
function parseHistory(value: unknown): ChatMessage[] | null {
    if (!Array.isArray(value) || value.length === 0) return null
    const messages = value
        .slice(-MAX_MESSAGES)
        .filter(
            (m): m is { role: 'user' | 'assistant'; content: string } =>
                !!m &&
                (m.role === 'user' || m.role === 'assistant') &&
                typeof m.content === 'string' &&
                m.content.trim().length > 0
        )
        .map((m) => ({ role: m.role, content: m.content.slice(0, MAX_MESSAGE_CHARS) }))
    if (messages.length === 0 || messages[messages.length - 1].role !== 'user') return null
    return messages
}

/** Newest turns that fit the budget; the latest user message is always kept. */
function trimHistory(messages: ChatMessage[]): ChatMessage[] {
    const kept: ChatMessage[] = []
    let used = 0
    for (let i = messages.length - 1; i >= 0; i--) {
        const cost = estimateMessageTokens([messages[i]])
        if (kept.length > 0 && used + cost > HISTORY_TOKEN_BUDGET) break
        kept.unshift(messages[i])
        used += cost
    }
    // Start on a user turn so the model never sees an orphaned assistant reply.
    while (kept.length > 1 && kept[0].role !== 'user') kept.shift()
    return kept
}

export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions)
    const userId = session?.user?.id
    if (!userId) {
        return jsonError('Unauthorized', 401)
    }

    if (!process.env.GROQ_API_KEY) {
        return jsonError('GROQ_API_KEY is not configured', 500)
    }

    let body: any
    try {
        body = await req.json()
    } catch {
        return jsonError('Invalid JSON body', 400)
    }

    const workspaceId = typeof body?.workspaceId === 'string' ? body.workspaceId : ''
    if (!workspaceId) {
        return jsonError('workspaceId is required', 400)
    }

    const history = parseHistory(body.messages)
    if (!history) {
        return jsonError('messages must end with a user message', 400)
    }

    // The tools read workspace data and the workspace's pool pays, so the caller
    // must belong to it. Create tools additionally need an editing role.
    const access = await requireWorkspaceAccess(workspaceId)
    if ('error' in access) {
        return jsonError(access.error, access.status)
    }

    const [role, workspace, user] = await Promise.all([
        getWorkspaceRole(workspaceId, userId),
        prisma.workspace.findUnique({ where: { id: workspaceId }, select: { name: true } }),
        prisma.user.findUnique({ where: { id: userId }, select: { name: true } }),
    ])

    const pageContext = typeof body.context === 'string' && body.context.trim()
        ? body.context.slice(0, MAX_CONTEXT_CHARS)
        : undefined

    const systemPrompt = buildSystemPrompt({
        userName: user?.name ?? null,
        workspaceName: workspace?.name ?? 'Workspace',
        role,
        timeZone: safeTimeZone(body.timeZone),
        now: new Date(),
        pageContext,
    })
    const messages: ChatMessage[] = [{ role: 'system', content: systemPrompt }, ...trimHistory(history)]

    // Reserve one round's worth; extra tool rounds are settled on real usage.
    const toolTokens = estimateTokens(JSON.stringify(toolDefinitions(role)))
    const reserve = await reserveAiCredits({
        userId,
        workspaceId,
        feature: 'agent',
        model: AGENT_MODEL,
        estimate: {
            inputTokens: estimateMessageTokens(messages) + toolTokens,
            outputTokens: MAX_OUTPUT_TOKENS,
        },
    })
    if (!reserve.ok) {
        return reserve.response
    }

    const abort = linkedAbortController(req.signal)
    const encoder = new TextEncoder()

    const stream = new ReadableStream<Uint8Array>({
        async start(controller) {
            let open = true
            const send = (event: AgentEvent) => {
                if (!open) return
                try {
                    controller.enqueue(encoder.encode(JSON.stringify(event) + '\n'))
                } catch {
                    open = false
                }
            }
            await runAgent({
                ctx: { userId, workspaceId, role },
                reservation: reserve.reservation,
                messages,
                send,
                signal: abort.signal,
            })
            open = false
            try {
                controller.close()
            } catch {
                // Already closed because the client cancelled.
            }
        },
        cancel() {
            abort.abort()
        },
    })

    return new Response(stream, {
        headers: {
            'Content-Type': 'application/x-ndjson; charset=utf-8',
            'Cache-Control': 'no-store',
        },
    })
}
