import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import Groq from 'groq-sdk'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

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
  "currency": "USD",
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
  "currency": "USD",
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

    if (!process.env.GROQ_API_KEY) {
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

    // Verify workspace access if workspaceId provided
    if (workspaceId) {
      const workspace = await prisma.workspace.findFirst({
        where: {
          id: workspaceId,
          OR: [
            { ownerId: session.user.id },
            { members: { some: { userId: session.user.id } } },
          ],
        },
      })
      if (!workspace) {
        return new Response(JSON.stringify({ error: 'Access denied' }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        })
      }
    }

    const systemPrompt = SYSTEM_PROMPTS[type]
    const userMessage = context
      ? `${prompt}\n\nAdditional context: ${context}`
      : prompt

    const stream = await groq.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      stream: true,
      temperature: 0.7,
      max_tokens: 2048,
    })

    const readableStream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder()
        for await (const chunk of stream) {
          const text = chunk.choices[0]?.delta?.content ?? ''
          if (text) {
            controller.enqueue(encoder.encode(text))
          }
        }
        controller.close()
      },
    })

    return new Response(readableStream, {
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
