import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { AI_CREDIT_COSTS, chargeAiCredits, refundAiCredits } from '@/lib/billing/ai-credits'
import { getGroq, type GroqCompletion } from '@/lib/groq'

export async function POST(req: NextRequest) {
  // Every other AI route requires a session. Without one this endpoint was an
  // open proxy to the Groq account: anyone could spend the quota.
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  if (!process.env.GROQ_API_KEY) {
    return new Response(JSON.stringify({ error: 'GROQ_API_KEY is not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const { templateType, campaignContext } = await req.json()

  const prompt = buildPrompt(templateType, campaignContext)

  // The campaign modal does not send a workspace, so this bills the caller's own.
  const charge = await chargeAiCredits(session.user.id, null, AI_CREDIT_COSTS.emailTemplate)
  if (!charge.ok) {
    return charge.response
  }

  let stream: GroqCompletion
  try {
    stream = await getGroq().chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        {
          role: 'system',
          content: `You are an expert email marketing copywriter. Generate professional, engaging HTML email templates.
Always return valid HTML with inline styles for email client compatibility.
Use a clean, modern design with good typography and clear CTAs.
Return ONLY the HTML — no markdown, no code blocks, no explanation.`,
        },
        { role: 'user', content: prompt },
      ],
      stream: true,
    })
  } catch (error) {
    // An upstream failure (bad key, quota, outage) used to escape as an empty 500.
    console.error('AI email template generation failed:', error)
    await refundAiCredits(charge)
    return new Response(JSON.stringify({ error: 'The AI service could not generate a template. Try again later.' }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const readableStream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder()
      for await (const chunk of stream) {
        const text = chunk.choices[0]?.delta?.content ?? ''
        if (text) controller.enqueue(encoder.encode(text))
      }
      controller.close()
    },
  })

  return new Response(readableStream, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
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
