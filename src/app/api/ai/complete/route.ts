import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { requireWorkspacePermission } from '@/lib/api/workspace'
import { getUserPageAccess } from '@/lib/workspace'
import { reserveAiCredits } from '@/lib/billing/ai-credits'
import { estimateMessageTokens } from '@/lib/billing/ai-pricing'
import { completeBilled, streamBilled } from '@/lib/ai/billed-completion'
import { UTILITY_MODEL } from '@/lib/ai/models'

/**
 * One-shot text tasks for editor features: rewrite in a tone, draft an outline,
 * suggest subject lines. No tools and no chat history, on the small model, so
 * they cost a credit or two. Returns the model's text as a plain-text stream.
 *
 * Body: { workspaceId | pageId, prompt, text?, json?, maxTokens? }
 *   - pageId bills the page's workspace (editor features know the page, not
 *     always the workspace) and requires access to that page.
 *   - json: true makes the model return one JSON object; say its shape in the prompt.
 */

const MAX_PROMPT_CHARS = 4000
const MAX_TEXT_CHARS = 12000
const DEFAULT_MAX_TOKENS = 1024
const MAX_MAX_TOKENS = 2048

const SYSTEM_PROMPT = `You are a writing assistant built into a business workspace app.
Do exactly the task you are given. Output only the result: no preamble, no explanation, no surrounding quotes, and no Markdown code fences.
Write in the same language as the text you are given, unless the task says otherwise.`

const jsonError = (error: string | undefined, status: number | undefined) =>
  new Response(JSON.stringify({ error: error ?? 'Request failed' }), {
    status: status ?? 500,
    headers: { 'Content-Type': 'application/json' },
  })

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

  const prompt = typeof body?.prompt === 'string' ? body.prompt.trim().slice(0, MAX_PROMPT_CHARS) : ''
  if (!prompt) {
    return jsonError('prompt is required', 400)
  }
  const text = typeof body.text === 'string' ? body.text.slice(0, MAX_TEXT_CHARS) : ''
  const json = body.json === true
  const maxTokens = Math.min(
    MAX_MAX_TOKENS,
    Math.max(64, Math.floor(Number(body.maxTokens) || DEFAULT_MAX_TOKENS))
  )

  // Resolve which workspace pays. A page id is trusted only after checking the
  // caller can open that page.
  let workspaceId = typeof body.workspaceId === 'string' ? body.workspaceId : ''
  if (!workspaceId && typeof body.pageId === 'string' && body.pageId) {
    const page = await prisma.page.findUnique({
      where: { id: body.pageId },
      select: { id: true, workspaceId: true },
    })
    if (!page || (await getUserPageAccess(page.id, userId, page.workspaceId)) === 'NONE') {
      return jsonError('Page not found', 404)
    }
    workspaceId = page.workspaceId
  }
  if (!workspaceId) {
    return jsonError('workspaceId or pageId is required', 400)
  }

  // These features write the result into content, so viewers can't use them
  // (and can't spend the workspace's credits).
  const access = await requireWorkspacePermission(workspaceId, 'content:create')
  if ('error' in access) {
    return jsonError(access.error, access.status)
  }

  const messages = [
    {
      role: 'system' as const,
      content: json ? `${SYSTEM_PROMPT}\nRespond with a single valid JSON object.` : SYSTEM_PROMPT,
    },
    { role: 'user' as const, content: text ? `${prompt}\n\n---\n${text}` : prompt },
  ]

  const reserve = await reserveAiCredits({
    userId,
    workspaceId,
    feature: 'complete',
    model: UTILITY_MODEL,
    estimate: { inputTokens: estimateMessageTokens(messages), outputTokens: maxTokens },
  })
  if (!reserve.ok) {
    return reserve.response
  }

  const headers = { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' }
  try {
    // JSON mode isn't streamed: the caller can only parse the complete object.
    if (json) {
      const { text: result } = await completeBilled({
        reservation: reserve.reservation,
        messages,
        maxTokens,
        temperature: 0.5,
        json: true,
        signal: req.signal,
      })
      return new Response(result, { headers })
    }

    const stream = await streamBilled({
      reservation: reserve.reservation,
      messages,
      maxTokens,
      temperature: 0.5,
      signal: req.signal,
    })
    return new Response(stream, { headers })
  } catch (error) {
    console.error('AI completion failed:', error)
    return jsonError('The AI service could not answer. Try again later.', 502)
  }
}
