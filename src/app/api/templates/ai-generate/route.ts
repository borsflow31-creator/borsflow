import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { requireWorkspacePermission } from '@/lib/api/workspace'
import { DEFAULT_CURRENCY } from '@/lib/currencies'
import { prisma } from '@/lib/prisma'
import { reserveAiCredits } from '@/lib/billing/ai-credits'
import { estimateMessageTokens } from '@/lib/billing/ai-pricing'
import { completeBilled } from '@/lib/ai/billed-completion'
import { UTILITY_MODEL } from '@/lib/ai/models'
import { AI_NOT_CONFIGURED, isAiConfigured, providerErrorMessage } from '@/lib/ai/provider'

const MAX_OUTPUT_TOKENS = 2048
const MAX_INPUT_CHARS = 4000

const SYSTEM_PROMPTS: Record<string, string> = {
  page: `You are an expert document architect for a professional workspace platform.
The user wants you to generate a page/document template.
Return ONLY valid JSON — no markdown, no code fences, no explanation — matching this exact shape:
{
  "title": string,
  "icon": string (single emoji),
  "blocks": [
    { "type": BlockType, "content": ContentObject }
  ]
}

BlockType values and their ContentObject shapes:
- "heading"       → { "text": string }
- "subheading"    → { "text": string }
- "text"          → { "text": string }
- "bullet"        → { "text": string }
- "numbered"      → { "text": string }
- "todo"          → { "text": string, "checked": false }
- "divider"       → {}
- "callout"       → { "text": string, "icon": emoji, "color": "blue"|"gray"|"green"|"yellow"|"red"|"purple" }
- "quote"         → { "text": string }

Rules:
- Create 10-16 blocks that form a complete, professional, ready-to-use template
- Use a mix of block types appropriate to the document purpose
- Be specific and detailed — avoid placeholder lorem ipsum text
- Structure content logically with clear sections`,

  quote: `You are an expert business consultant.
The user wants a quote/proposal template for a specific business context.
Return ONLY valid JSON — no markdown, no code fences, no explanation — matching this exact shape:
{
  "notes": string,
  "terms": string,
  "currency": string (the code given below),
  "taxRate": number (0-25),
  "items": [
    { "description": string, "quantity": number, "unitPrice": number }
  ]
}

Rules:
- Create 3-7 realistic line items appropriate to the described context
- unitPrice values should be realistic USD amounts for professional services
- notes should be a professional closing statement (1-2 sentences)
- terms should include payment terms, validity period, and any key conditions
- taxRate should be typical (e.g., 0, 8.5, 10, 15, 20)`,

  invoice: `You are an expert business consultant.
The user wants an invoice template for a specific business context.
Return ONLY valid JSON — no markdown, no code fences, no explanation — matching this exact shape:
{
  "notes": string,
  "terms": string,
  "currency": string (the code given below),
  "taxRate": number (0-25),
  "items": [
    { "description": string, "quantity": number, "unitPrice": number }
  ]
}

Rules:
- Create 3-6 realistic invoice line items for the described context
- unitPrice values should be realistic USD amounts
- notes should thank the client and provide payment instructions (1-2 sentences)
- terms should include payment due date policy, late fees, and accepted payment methods
- taxRate should be typical (e.g., 0, 8.5, 10, 15, 20)`,

  kanban: `You are an expert project manager.
The user wants a kanban board template for a specific project type.
Return ONLY valid JSON — no markdown, no code fences, no explanation — matching this exact shape:
{
  "projectName": string,
  "projectColor": string (hex color like "#6366f1"),
  "description": string,
  "cards": [
    { "title": string, "status": "todo"|"inprogress"|"done", "priority": "low"|"medium"|"high" }
  ]
}

Rules:
- Create 10-16 cards distributed realistically across the three statuses
- Most cards should be "todo", some "inprogress", a few "done" (to show progress)
- Card titles should be specific, actionable tasks (not vague like "task 1")
- Priority should be varied and realistic
- projectColor should match the project theme (use a professional hex color)
- description should be 1-2 sentences describing the project scope`,
}

// POST /api/templates/ai-generate
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    if (!isAiConfigured()) {
      return new Response(JSON.stringify({ error: 'AI service not configured' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const body = await request.json()
    const { type, prompt, workspaceId, context } = body

    if (!type || !prompt) {
      return new Response(JSON.stringify({ error: 'type and prompt are required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const validTypes = ['page', 'quote', 'invoice', 'kanban']
    if (!validTypes.includes(type)) {
      return new Response(JSON.stringify({ error: `type must be one of: ${validTypes.join(', ')}` }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // The workspace's credit pool pays, so the caller must be able to create
    // content there; a viewer can't spend it.
    if (typeof workspaceId !== 'string' || !workspaceId) {
      return new Response(JSON.stringify({ error: 'workspaceId is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    const access = await requireWorkspacePermission(workspaceId, 'content:create')
    if ('error' in access) {
      return new Response(JSON.stringify({ error: access.error }), {
        status: access.status,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // The shape prompts leave the currency to this line, so a workspace that
    // prices in dinars does not get a quote template priced in dollars.
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { currency: true },
    })
    const currency = workspace?.currency || DEFAULT_CURRENCY
    const systemPrompt = `${SYSTEM_PROMPTS[type]}

Use "${currency}" as the currency.`
    const trimmedPrompt = String(prompt).slice(0, MAX_INPUT_CHARS)
    const userMessage = context
      ? `${trimmedPrompt}\n\nAdditional context: ${String(context).slice(0, MAX_INPUT_CHARS)}`
      : trimmedPrompt
    const messages = [
      { role: 'system' as const, content: systemPrompt },
      { role: 'user' as const, content: userMessage },
    ]

    const reserve = await reserveAiCredits({
      userId: session.user.id,
      workspaceId,
      feature: 'template',
      model: UTILITY_MODEL,
      estimate: { inputTokens: estimateMessageTokens(messages), outputTokens: MAX_OUTPUT_TOKENS },
    })
    if (!reserve.ok) {
      return reserve.response
    }

    // Not streamed: JSON mode guarantees a parseable object, and the panel only
    // parses once the whole answer is in anyway.
    let text: string
    try {
      ;({ text } = await completeBilled({
        reservation: reserve.reservation,
        messages,
        maxTokens: MAX_OUTPUT_TOKENS,
        temperature: 0.7,
        json: true,
        signal: request.signal,
      }))
    } catch (error) {
      console.error('AI template generation failed:', error)
      return new Response(JSON.stringify({ error: providerErrorMessage(error) ?? 'The AI service could not generate a template. Try again later.' }), {
        status: 502,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    return new Response(text, {
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    })
  } catch (error) {
    console.error('Error generating template with AI:', error)
    return new Response(JSON.stringify({ error: 'AI generation failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
