import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { requireWorkspacePermission } from '@/lib/api/workspace'
import { reserveAiCredits } from '@/lib/billing/ai-credits'
import { estimateMessageTokens } from '@/lib/billing/ai-pricing'
import { streamBilled } from '@/lib/ai/billed-completion'
import { QUALITY_MODEL } from '@/lib/ai/models'

const MAX_OUTPUT_TOKENS = 3000
const MAX_FIELD_CHARS = 1000

const json = (body: unknown, status = 500) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

export async function POST(req: NextRequest) {
  // Every other AI route requires a session. Without one this endpoint was an
  // open proxy to the Groq account: anyone could spend the quota.
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return json({ error: 'Unauthorized' }, 401)
  }

  if (!process.env.GROQ_API_KEY) {
    return json({ error: 'GROQ_API_KEY is not configured' }, 500)
  }

  const { templateType, campaignContext, workspaceId } = await req.json()

  if (typeof workspaceId !== 'string' || !workspaceId) {
    return json({ error: 'workspaceId is required' }, 400)
  }
  // Drafting campaign content is content creation: viewers can't spend the pool.
  const access = await requireWorkspacePermission(workspaceId, 'content:create')
  if ('error' in access) {
    return json({ error: access.error }, access.status)
  }

  const context: Record<string, string> = {}
  for (const key of ['name', 'description', 'subject', 'fromName']) {
    const value = campaignContext?.[key]
    if (typeof value === 'string') context[key] = value.slice(0, MAX_FIELD_CHARS)
  }

  const messages = [
    {
      role: 'system' as const,
      content: `You are an expert email marketing copywriter. Generate professional, engaging HTML email templates.
Always return valid HTML with inline styles for email client compatibility.
Use a clean, modern design with good typography and clear CTAs.
Return ONLY the HTML — no markdown, no code blocks, no explanation.`,
    },
    { role: 'user' as const, content: buildPrompt(String(templateType ?? ''), context) },
  ]

  const reserve = await reserveAiCredits({
    userId: session.user.id,
    workspaceId,
    feature: 'email_template',
    model: QUALITY_MODEL,
    estimate: { inputTokens: estimateMessageTokens(messages), outputTokens: MAX_OUTPUT_TOKENS },
  })
  if (!reserve.ok) {
    return reserve.response
  }

  try {
    const stream = await streamBilled({
      reservation: reserve.reservation,
      messages,
      maxTokens: MAX_OUTPUT_TOKENS,
      signal: req.signal,
    })
    return new Response(stream, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
  } catch (error) {
    // An upstream failure (bad key, quota, outage) used to escape as an empty 500.
    console.error('AI email template generation failed:', error)
    return json({ error: 'The AI service could not generate a template. Try again later.' }, 502)
  }
}

function buildPrompt(templateType: string, context: Record<string, string>) {
  const ctx = [
    context.name && `Campaign: ${context.name}`,
    context.description && `Goal: ${context.description}`,
    context.subject && `Subject: ${context.subject}`,
    context.fromName && `Brand: ${context.fromName}`,
  ]
    .filter(Boolean)
    .join('\n')

  const templates: Record<string, string> = {
    welcome: `Create a warm welcome email HTML template for a new subscriber/user.
${ctx}
Include: greeting, value proposition, 2-3 key benefits, a clear CTA button, and footer with unsubscribe link.`,

    promotional: `Create a promotional marketing email HTML template.
${ctx}
Include: attention-grabbing header, offer/discount highlight, product/service description, urgency element, CTA button, footer.`,

    newsletter: `Create a professional newsletter email HTML template.
${ctx}
Include: branded header, 2-3 content sections with headings, a featured article area, social links, footer with unsubscribe.`,

    announcement: `Create an announcement email HTML template.
${ctx}
Include: big announcement header, details section, what it means for the reader, CTA, footer.`,

    followup: `Create a follow-up / re-engagement email HTML template.
${ctx}
Include: personalized opener, reminder of value, special offer or incentive, CTA, warm closing, footer.`,

    transactional: `Create a transactional/confirmation email HTML template.
${ctx}
Include: confirmation header, order/action summary table, next steps, support contact, footer.`,
  }

  return templates[templateType] || templates.promotional
}
