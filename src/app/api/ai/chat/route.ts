import { NextRequest } from 'next/server'
import Groq from 'groq-sdk'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { requireWorkspaceAccess } from '@/lib/api/workspace'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

const tools = [
    {
        type: 'function' as const,
        function: {
            name: 'search_pages',
            description: 'Search for and return pages in the current workspace. Call this when you need context about documents, notes, or knowledge base.',
            parameters: {
                type: 'object',
                properties: { query: { type: 'string', description: 'Search term to filter page titles' } },
                required: [],
            },
        },
    },
    {
        type: 'function' as const,
        function: {
            name: 'get_crm_leads',
            description: 'Retrieve a list of CRM leads in the workspace. Useful for getting contact information, statuses, and values of ongoing deals.',
            parameters: {
                type: 'object',
                properties: { status: { type: 'string', description: 'Optional status to filter leads (e.g. "new", "won", "lost")' } },
                required: [],
            },
        },
    },
    {
        type: 'function' as const,
        function: {
            name: 'get_meetings',
            description: 'Retrieve upcoming or past meetings. Useful for checking the user\'s schedule.',
            parameters: {
                type: 'object',
                properties: {},
                required: [],
            },
        },
    },
    {
        type: 'function' as const,
        function: {
            name: 'get_financials',
            description: 'Retrieve recent quotes and invoices to answer questions about billing and financial transactions.',
            parameters: {
                type: 'object',
                properties: {},
                required: [],
            },
        },
    },
    {
        type: 'function' as const,
        function: {
            name: 'list_templates',
            description: 'List available templates for the workspace. Call when user asks what templates are available, wants to create something from a template, or asks about template options.',
            parameters: {
                type: 'object',
                properties: {
                    type: {
                        type: 'string',
                        description: 'Optional: filter by template type — "page", "quote", "invoice", or "kanban"',
                    },
                },
                required: [],
            },
        },
    },
];

async function executeToolCall(toolCall: any, workspaceId: string) {
    const args = JSON.parse(toolCall.function.arguments || '{}')
    try {
        switch (toolCall.function.name) {
            case 'search_pages':
                const pages = await prisma.page.findMany({
                    where: { workspaceId, title: { contains: args.query || '' } },
                    select: { title: true, isPublic: true },
                    take: 10
                })
                return JSON.stringify(pages)
            
            case 'get_crm_leads':
                const leads = await prisma.lead.findMany({
                    where: { pipeline: { workspaceId }, ...(args.status ? { status: args.status } : {}) },
                    select: { firstName: true, lastName: true, company: true, status: true, value: true },
                    take: 10
                })
                return JSON.stringify(leads)

            case 'get_meetings':
                const meetings = await prisma.meeting.findMany({
                    where: { workspaceId },
                    orderBy: { startTime: 'asc' },
                    select: { title: true, startTime: true, endTime: true, status: true },
                    take: 5
                })
                return JSON.stringify(meetings)
                
            case 'get_financials':
                const invoices = await prisma.invoice.findMany({
                    where: { workspaceId },
                    orderBy: { issueDate: 'desc' },
                    select: { invoiceNumber: true, clientName: true, total: true, status: true },
                    take: 5
                })
                const quotes = await prisma.quote.findMany({
                    where: { workspaceId },
                    orderBy: { issueDate: 'desc' },
                    select: { quoteNumber: true, clientName: true, total: true, status: true },
                    take: 5
                })
                return JSON.stringify({ invoices, quotes })

            case 'list_templates':
                const templates = await prisma.universalTemplate.findMany({
                    where: {
                        OR: [{ isSystem: true }, { workspaceId }],
                        ...(args.type ? { type: args.type } : {}),
                    },
                    select: { id: true, name: true, type: true, description: true, isSystem: true },
                    orderBy: [{ isSystem: 'desc' }, { usageCount: 'desc' }],
                    take: 12,
                })
                return JSON.stringify(templates)

            default:
                return '{"error": "Unknown function"}'
        }
    } catch (e: any) {
        return JSON.stringify({ error: e.message })
    }
}

const jsonError = (error: string | undefined, status: number | undefined) =>
    new Response(JSON.stringify({ error: error ?? 'Request failed' }), {
        status: status ?? 500,
        headers: { 'Content-Type': 'application/json' },
    })

export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
        return jsonError('Unauthorized', 401)
    }

    if (!process.env.GROQ_API_KEY) {
        return new Response(JSON.stringify({ error: 'GROQ_API_KEY is not configured' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        })
    }

    const { messages, context, workspaceId } = await req.json()

    // The tools below read workspace data, so the caller must belong to that workspace.
    if (workspaceId) {
        const access = await requireWorkspaceAccess(workspaceId)
        if ('error' in access) {
            return jsonError(access.error, access.status)
        }
    }

    const basePrompt = `You are the built-in AI assistant for this platform. Your sole purpose is to help users get the most out of this product — its documents, pages, CRM, meetings, invoices, quotes, and workspace features.

Rules you must follow at all times:
- Only discuss features, data, and tasks that belong to this platform.
- Never mention, recommend, compare, or link to any other SaaS product, tool, or competitor (e.g. Notion, ClickUp, Monday, Salesforce, HubSpot, or any other external service).
- Never say anything negative about this platform or imply that another tool would be better.
- Never engage with political topics, news, or opinions of any kind. If asked, politely decline and redirect to how you can help within this platform.
- If a user asks you something outside the scope of this platform, respond with: "I'm only here to help you with this platform. Is there something I can assist you with here?"
- Be helpful, concise, and focused entirely on making the user successful within this product.`

    const systemMessage = {
        role: 'system' as const,
        content: context
            ? `${basePrompt}\n\nCurrent document context:\n${context}`
            : basePrompt,
    }

    const conversation: any[] = [systemMessage, ...messages]

    // Pre-flight check: we call the LLM without streaming if we have tools to see if it wants to use them
    let useTools = !!workspaceId;
    let model = 'llama-3.1-8b-instant';

    if (useTools) {
        try {
            const initialResponse = await groq.chat.completions.create({
                model,
                messages: conversation,
                tools: tools,
                tool_choice: 'auto',
                stream: false,
            });

            const responseMessage = initialResponse.choices[0]?.message;

            if (responseMessage?.tool_calls && responseMessage.tool_calls.length > 0) {
                conversation.push(responseMessage); // Add assistant's tool call request

                for (const toolCall of responseMessage.tool_calls) {
                    const toolResult = await executeToolCall(toolCall, workspaceId);
                    conversation.push({
                        tool_call_id: toolCall.id,
                        role: 'tool',
                        name: toolCall.function.name,
                        content: toolResult,
                    });
                }
            }
        } catch (error) {
            console.error('Tool calling failed:', error);
            // Fallback to text conversation if tool calling fails (e.g. rate limit, or model not found)
        }
    }

    // Final streaming generation
    const stream = await groq.chat.completions.create({
        model,
        messages: conversation,
        stream: true,
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
}
