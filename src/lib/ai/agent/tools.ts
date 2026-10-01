import type Groq from 'groq-sdk'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { buildPageAccessWhere, getUserPageAccess, hasPermission, type Role } from '@/lib/workspace'
import { createPage } from '@/lib/services/pages'
import { createKanbanCard, CARD_PRIORITIES, CARD_STATUSES } from '@/lib/services/kanban'
import { createLead } from '@/lib/services/leads'
import { createMeeting } from '@/lib/services/meetings'
import { ServiceError } from '@/lib/services/errors'
import { blocksToText, pageContentToText, snippetAround, textToBlocks, truncate } from '@/lib/ai/page-text'

/**
 * The workspace assistant's tools. Every query is scoped to the caller's
 * workspace, page reads honour page-level access, and create tools need the
 * `content:create` permission (viewers are read-only).
 */

export interface ToolContext {
  userId: string
  workspaceId: string
  role: Role
}

export interface ToolOutcome {
  /** What the model sees, serialised to JSON and capped in size. */
  data: unknown
  /** A created record the UI can link to. */
  link?: { label: string; url: string }
}

interface AgentTool {
  name: string
  /** Shown in the chat while the tool runs, e.g. "Searching pages". */
  label: string
  description: string
  parameters: Record<string, unknown>
  /** Create tools need `content:create`; read tools only workspace membership. */
  writes: boolean
  execute(ctx: ToolContext, args: Args): Promise<ToolOutcome>
}

/** Cap on one tool result, in characters, so a big lookup can't flood the context. */
const MAX_RESULT_CHARS = 6000
const PAGE_READ_CHARS = 5000

// ─── Argument helpers ────────────────────────────────────────────────────────
// The model's arguments are untrusted JSON: coerce and bound every field.

type Args = Record<string, unknown>

function str(args: Args, key: string, max = 200): string | undefined {
  const value = args[key]
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed ? trimmed.slice(0, max) : undefined
}

function requireStr(args: Args, key: string, max = 200): string {
  const value = str(args, key, max)
  if (!value) throw new ServiceError(`"${key}" is required`)
  return value
}

function num(args: Args, key: string): number | undefined {
  const value = args[key]
  const parsed = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN
  return Number.isFinite(parsed) ? parsed : undefined
}

function limitArg(args: Args, fallback: number, max: number): number {
  return Math.min(max, Math.max(1, Math.floor(num(args, 'limit') ?? fallback)))
}

function oneOf<T extends string>(args: Args, key: string, allowed: readonly T[]): T | undefined {
  const value = str(args, key)?.toLowerCase()
  return value && (allowed as readonly string[]).includes(value) ? (value as T) : undefined
}

function dateArg(args: Args, key: string): Date | undefined {
  const value = str(args, key, 40)
  if (!value) return undefined
  const date = new Date(value)
  if (isNaN(date.getTime())) throw new ServiceError(`"${key}" is not a valid date`)
  return date
}

const insensitive = (value: string) => ({ contains: value, mode: 'insensitive' as const })

// ─── Tools ───────────────────────────────────────────────────────────────────

const TOOLS: AgentTool[] = [
  {
    name: 'search_pages',
    label: 'Searching pages',
    description:
      'Search the workspace\'s pages (documents, notes, wiki) by words in the title or body. Returns ids, titles and a matching excerpt. Use read_page with an id to read a page in full.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Words to look for in page titles and content' },
        limit: { type: 'integer', description: 'Max results (default 8, max 15)' },
      },
      required: ['query'],
    },
    writes: false,
    async execute(ctx, args) {
      const query = requireStr(args, 'query', 100)
      const accessWhere = await buildPageAccessWhere(ctx.userId, ctx.workspaceId)
      const pages = await prisma.page.findMany({
        where: {
          AND: [
            accessWhere,
            { workspaceId: ctx.workspaceId },
            { OR: [{ title: insensitive(query) }, { content: insensitive(query) }] },
          ],
        },
        select: { id: true, title: true, content: true, updatedAt: true },
        orderBy: { updatedAt: 'desc' },
        take: limitArg(args, 8, 15),
      })
      return {
        data: pages.map((page) => ({
          id: page.id,
          title: page.title,
          updatedAt: page.updatedAt,
          excerpt: snippetAround(pageContentToText(page.content), query),
        })),
      }
    },
  },
  {
    name: 'read_page',
    label: 'Reading a page',
    description: 'Read the full text of one page by its id (from search_pages).',
    parameters: {
      type: 'object',
      properties: { page_id: { type: 'string', description: 'The page id' } },
      required: ['page_id'],
    },
    writes: false,
    async execute(ctx, args) {
      const pageId = requireStr(args, 'page_id', 64)
      const page = await prisma.page.findFirst({
        where: { id: pageId, workspaceId: ctx.workspaceId },
        select: {
          id: true,
          title: true,
          content: true,
          updatedAt: true,
          blocks: { select: { type: true, content: true, order: true } },
        },
      })
      // Same answer for "missing" and "not yours", so ids can't be probed.
      if (!page || (await getUserPageAccess(page.id, ctx.userId, ctx.workspaceId)) === 'NONE') {
        return { data: { error: 'Page not found or you do not have access to it' } }
      }
      let text = pageContentToText(page.content)
      if (!text && page.blocks.length > 0) text = blocksToText(page.blocks)
      return {
        data: {
          id: page.id,
          title: page.title,
          updatedAt: page.updatedAt,
          url: `/pages/${page.id}`,
          text: truncate(text || '(empty page)', PAGE_READ_CHARS),
        },
      }
    },
  },
  {
    name: 'search_leads',
    label: 'Looking up CRM leads',
    description:
      'Find CRM leads by name, company or email, and/or by status. Returns contact details, deal value, stage and notes.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Name, company or email to match' },
        status: {
          type: 'string',
          description: 'Filter by status: new, contacted, qualified, proposal, negotiation, won, lost',
        },
        limit: { type: 'integer', description: 'Max results (default 10, max 25)' },
      },
      required: [],
    },
    writes: false,
    async execute(ctx, args) {
      const query = str(args, 'query', 100)
      const status = str(args, 'status', 30)?.toLowerCase()
      const leads = await prisma.lead.findMany({
        where: {
          pipeline: { workspaceId: ctx.workspaceId },
          ...(status ? { status } : {}),
          ...(query
            ? {
                OR: [
                  { firstName: insensitive(query) },
                  { lastName: insensitive(query) },
                  { company: insensitive(query) },
                  { email: insensitive(query) },
                ],
              }
            : {}),
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          company: true,
          position: true,
          status: true,
          stage: true,
          value: true,
          notes: true,
          updatedAt: true,
          pipeline: { select: { name: true } },
        },
        orderBy: { updatedAt: 'desc' },
        take: limitArg(args, 10, 25),
      })
      return {
        data: leads.map(({ notes, pipeline, ...lead }) => ({
          ...lead,
          pipeline: pipeline.name,
          notes: notes ? truncate(notes, 200) : null,
        })),
      }
    },
  },
  {
    name: 'list_tasks',
    label: 'Checking tasks',
    description:
      'List kanban tasks, optionally filtered by status, priority, words in the title, or due date. Sorted by due date.',
    parameters: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: [...CARD_STATUSES] },
        priority: { type: 'string', enum: [...CARD_PRIORITIES] },
        query: { type: 'string', description: 'Words in the task title' },
        due_before: { type: 'string', description: 'ISO date; only tasks due before it' },
        limit: { type: 'integer', description: 'Max results (default 15, max 30)' },
      },
      required: [],
    },
    writes: false,
    async execute(ctx, args) {
      const status = oneOf(args, 'status', CARD_STATUSES)
      const priority = oneOf(args, 'priority', CARD_PRIORITIES)
      const query = str(args, 'query', 100)
      const dueBefore = dateArg(args, 'due_before')
      const cards = await prisma.kanbanCard.findMany({
        where: {
          workspaceId: ctx.workspaceId,
          ...(status ? { status } : {}),
          ...(priority ? { priority } : {}),
          ...(query ? { title: insensitive(query) } : {}),
          ...(dueBefore ? { dueDate: { lt: dueBefore } } : {}),
        },
        select: {
          id: true,
          title: true,
          description: true,
          status: true,
          priority: true,
          dueDate: true,
          project: { select: { name: true } },
        },
        orderBy: [{ dueDate: { sort: 'asc', nulls: 'last' } }, { updatedAt: 'desc' }],
        take: limitArg(args, 15, 30),
      })
      return {
        data: cards.map(({ description, project, ...card }) => ({
          ...card,
          project: project?.name ?? null,
          description: description ? truncate(description, 200) : null,
        })),
      }
    },
  },
  {
    name: 'list_meetings',
    label: 'Checking meetings',
    description:
      'List meetings. Defaults to upcoming meetings (soonest first); use range "past" for recent ones (latest first), or give from/to dates.',
    parameters: {
      type: 'object',
      properties: {
        range: { type: 'string', enum: ['upcoming', 'past'] },
        from: { type: 'string', description: 'ISO date/time lower bound' },
        to: { type: 'string', description: 'ISO date/time upper bound' },
        limit: { type: 'integer', description: 'Max results (default 10, max 25)' },
      },
      required: [],
    },
    writes: false,
    async execute(ctx, args) {
      const past = oneOf(args, 'range', ['upcoming', 'past'] as const) === 'past'
      const now = new Date()
      const from = dateArg(args, 'from') ?? (past ? undefined : now)
      const to = dateArg(args, 'to') ?? (past ? now : undefined)
      const meetings = await prisma.meeting.findMany({
        where: {
          workspaceId: ctx.workspaceId,
          ...(from || to ? { startTime: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {}),
        },
        select: {
          id: true,
          title: true,
          startTime: true,
          endTime: true,
          timezone: true,
          status: true,
          platform: true,
          meetingUrl: true,
          lead: { select: { firstName: true, lastName: true, company: true } },
        },
        orderBy: { startTime: past ? 'desc' : 'asc' },
        take: limitArg(args, 10, 25),
      })
      return { data: meetings }
    },
  },
  {
    name: 'get_financials',
    label: 'Checking invoices and quotes',
    description:
      'List invoices and/or quotes, newest first, optionally filtered by status (e.g. draft, sent, paid, overdue, accepted) or client name.',
    parameters: {
      type: 'object',
      properties: {
        kind: { type: 'string', enum: ['invoices', 'quotes', 'both'] },
        status: { type: 'string' },
        client: { type: 'string', description: 'Client name to match' },
        limit: { type: 'integer', description: 'Max results per kind (default 10, max 25)' },
      },
      required: [],
    },
    writes: false,
    async execute(ctx, args) {
      const kind = oneOf(args, 'kind', ['invoices', 'quotes', 'both'] as const) ?? 'both'
      const status = str(args, 'status', 30)?.toLowerCase()
      const client = str(args, 'client', 100)
      const take = limitArg(args, 10, 25)
      const where = {
        workspaceId: ctx.workspaceId,
        ...(status ? { status } : {}),
        ...(client ? { clientName: insensitive(client) } : {}),
      }
      const [invoices, quotes] = await Promise.all([
        kind === 'quotes'
          ? Promise.resolve(undefined)
          : prisma.invoice.findMany({
              where,
              orderBy: { issueDate: 'desc' },
              select: {
                invoiceNumber: true,
                clientName: true,
                clientCompany: true,
                status: true,
                currency: true,
                total: true,
                amountDue: true,
                issueDate: true,
                dueDate: true,
                paidDate: true,
              },
              take,
            }),
        kind === 'invoices'
          ? Promise.resolve(undefined)
          : prisma.quote.findMany({
              where,
              orderBy: { issueDate: 'desc' },
              select: {
                quoteNumber: true,
                clientName: true,
                clientCompany: true,
                status: true,
                currency: true,
                total: true,
                issueDate: true,
                validUntil: true,
              },
              take,
            }),
      ])
      return { data: { ...(invoices ? { invoices } : {}), ...(quotes ? { quotes } : {}) } }
    },
  },
  {
    name: 'search_products',
    label: 'Searching products',
    description: 'Search the product catalog by name, SKU or category. Returns prices, units and stock.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Name, SKU or category to match' },
        limit: { type: 'integer', description: 'Max results (default 10, max 25)' },
      },
      required: [],
    },
    writes: false,
    async execute(ctx, args) {
      const query = str(args, 'query', 100)
      const products = await prisma.product.findMany({
        where: {
          workspaceId: ctx.workspaceId,
          ...(query
            ? { OR: [{ name: insensitive(query) }, { sku: insensitive(query) }, { category: insensitive(query) }] }
            : {}),
        },
        select: {
          name: true,
          sku: true,
          category: true,
          price: true,
          unit: true,
          taxRate: true,
          stockQuantity: true,
          isActive: true,
        },
        orderBy: { updatedAt: 'desc' },
        take: limitArg(args, 10, 25),
      })
      return { data: products }
    },
  },
  {
    name: 'list_templates',
    label: 'Browsing templates',
    description:
      'List templates available in this workspace. Use when the user asks what templates exist or wants to start from one.',
    parameters: {
      type: 'object',
      properties: {
        type: { type: 'string', enum: ['page', 'quote', 'invoice', 'kanban'] },
      },
      required: [],
    },
    writes: false,
    async execute(ctx, args) {
      const type = oneOf(args, 'type', ['page', 'quote', 'invoice', 'kanban'] as const)
      const templates = await prisma.universalTemplate.findMany({
        where: {
          OR: [{ isSystem: true }, { workspaceId: ctx.workspaceId }],
          ...(type ? { type } : {}),
        },
        select: { id: true, name: true, type: true, description: true, isSystem: true },
        orderBy: [{ isSystem: 'desc' }, { usageCount: 'desc' }],
        take: 12,
      })
      return { data: templates }
    },
  },

  // ─── Create tools ──────────────────────────────────────────────────────────

  {
    name: 'create_page',
    label: 'Creating a page',
    description:
      'Create a new page. Only when the user explicitly asks to create or write a page/document. Content may use simple Markdown: #/##/### headings, "- " bullets, "1. " numbered items, "- [ ] " todos, and plain paragraphs.',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        content: { type: 'string', description: 'Page body in simple Markdown' },
        parent_page_id: { type: 'string', description: 'Optional id of a page to nest it under' },
      },
      required: ['title'],
    },
    writes: true,
    async execute(ctx, args) {
      const title = requireStr(args, 'title', 200)
      const content = str(args, 'content', 20_000)
      const page = await createPage({
        workspaceId: ctx.workspaceId,
        userId: ctx.userId,
        role: ctx.role,
        title,
        parentId: str(args, 'parent_page_id', 64),
        blocks: content ? textToBlocks(content) : undefined,
      })
      const url = `/pages/${page.id}`
      return { data: { created: 'page', id: page.id, title: page.title, url }, link: { label: page.title, url } }
    },
  },
  {
    name: 'create_task',
    label: 'Creating a task',
    description:
      'Create a kanban task. Only when the user explicitly asks to add or create a task/to-do. Give due_date as an ISO date.',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        description: { type: 'string' },
        priority: { type: 'string', enum: [...CARD_PRIORITIES] },
        status: { type: 'string', enum: [...CARD_STATUSES] },
        due_date: { type: 'string', description: 'ISO date, e.g. 2026-10-03' },
        project: { type: 'string', description: 'Optional kanban project name' },
      },
      required: ['title'],
    },
    writes: true,
    async execute(ctx, args) {
      const projectName = str(args, 'project', 100)
      let projectId: string | undefined
      if (projectName) {
        const project = await prisma.kanbanProject.findFirst({
          where: { workspaceId: ctx.workspaceId, name: { equals: projectName, mode: 'insensitive' } },
          select: { id: true },
        })
        if (!project) throw new ServiceError(`No kanban project named "${projectName}"`)
        projectId = project.id
      }
      const card = await createKanbanCard({
        workspaceId: ctx.workspaceId,
        userId: ctx.userId,
        title: requireStr(args, 'title', 200),
        description: str(args, 'description', 2000) ?? null,
        priority: oneOf(args, 'priority', CARD_PRIORITIES) ?? 'medium',
        status: oneOf(args, 'status', CARD_STATUSES) ?? 'todo',
        dueDate: dateArg(args, 'due_date') ?? null,
        projectId,
      })
      const url = '/kanban-board-view'
      return {
        data: { created: 'task', id: card.id, title: card.title, dueDate: card.dueDate, url },
        link: { label: card.title, url },
      }
    },
  },
  {
    name: 'create_lead',
    label: 'Adding a CRM lead',
    description:
      'Add a lead to the CRM. Only when the user explicitly asks to add or create a lead/contact. Goes into the named pipeline, or the first pipeline if none is given.',
    parameters: {
      type: 'object',
      properties: {
        first_name: { type: 'string' },
        last_name: { type: 'string' },
        email: { type: 'string' },
        phone: { type: 'string' },
        company: { type: 'string' },
        position: { type: 'string' },
        value: { type: 'number', description: 'Estimated deal value' },
        notes: { type: 'string' },
        pipeline: { type: 'string', description: 'Optional pipeline name' },
      },
      required: ['first_name', 'last_name'],
    },
    writes: true,
    async execute(ctx, args) {
      const pipelineName = str(args, 'pipeline', 100)
      const pipeline = await prisma.pipeline.findFirst({
        where: {
          workspaceId: ctx.workspaceId,
          ...(pipelineName ? { name: { equals: pipelineName, mode: 'insensitive' } } : {}),
        },
        orderBy: { order: 'asc' },
        select: { id: true, workspaceId: true, stages: true, name: true },
      })
      if (!pipeline) {
        throw new ServiceError(
          pipelineName ? `No pipeline named "${pipelineName}"` : 'This workspace has no CRM pipeline yet'
        )
      }
      const lead = await createLead(pipeline, {
        firstName: requireStr(args, 'first_name', 100),
        lastName: requireStr(args, 'last_name', 100),
        email: str(args, 'email', 200) ?? null,
        phone: str(args, 'phone', 50) ?? null,
        company: str(args, 'company', 200) ?? null,
        position: str(args, 'position', 200) ?? null,
        value: num(args, 'value') ?? null,
        notes: str(args, 'notes', 2000) ?? null,
        source: 'AI assistant',
      })
      const label = `${lead.firstName} ${lead.lastName}`
      const url = '/crm'
      return {
        data: { created: 'lead', id: lead.id, name: label, pipeline: pipeline.name, stage: lead.stage, url },
        link: { label, url },
      }
    },
  },
  {
    name: 'create_meeting',
    label: 'Scheduling a meeting',
    description:
      'Put a meeting on the workspace calendar. Only when the user explicitly asks to schedule one. start_time must be a full ISO 8601 date-time with timezone offset.',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        start_time: { type: 'string', description: 'ISO 8601, e.g. 2026-10-02T15:00:00+02:00' },
        duration_minutes: { type: 'integer', description: 'Default 30' },
        platform: { type: 'string', enum: ['in_person', 'zoom'] },
        lead_id: { type: 'string', description: 'Optional lead id from search_leads' },
      },
      required: ['title', 'start_time'],
    },
    writes: true,
    async execute(ctx, args) {
      const start = dateArg(args, 'start_time')
      if (!start) throw new ServiceError('"start_time" is required')
      const platform = oneOf(args, 'platform', ['in_person', 'zoom'] as const)
      const meeting = await createMeeting({
        workspaceId: ctx.workspaceId,
        userId: ctx.userId,
        title: requireStr(args, 'title', 200),
        startTime: start,
        duration: Math.min(24 * 60, Math.max(5, Math.round(num(args, 'duration_minutes') ?? 30))),
        platform: platform === 'zoom' ? 'zoom' : null,
        leadId: str(args, 'lead_id', 64) ?? null,
      })
      const url = '/meetings'
      return {
        data: {
          created: 'meeting',
          id: meeting.id,
          title: meeting.title,
          startTime: meeting.startTime,
          endTime: meeting.endTime,
          meetingUrl: meeting.meetingUrl || null,
          url,
        },
        link: { label: meeting.title, url },
      }
    },
  },
]

const TOOLS_BY_NAME = new Map(TOOLS.map((tool) => [tool.name, tool]))

/** Tool definitions for the model. Viewers are not offered create tools at all. */
export function toolDefinitions(role: Role): Groq.Chat.Completions.ChatCompletionTool[] {
  const canCreate = hasPermission(role, 'content:create')
  return TOOLS.filter((tool) => !tool.writes || canCreate).map((tool) => ({
    type: 'function' as const,
    function: { name: tool.name, description: tool.description, parameters: tool.parameters },
  }))
}

export function toolLabel(name: string): string {
  return TOOLS_BY_NAME.get(name)?.label ?? 'Working'
}

/**
 * Run one tool call. Never throws: every failure becomes an `{ error }` result
 * the model can read and recover from, without leaking database internals.
 */
export async function runTool(
  ctx: ToolContext,
  name: string,
  rawArguments: string | undefined
): Promise<ToolOutcome & { ok: boolean; content: string }> {
  const tool = TOOLS_BY_NAME.get(name)

  let outcome: ToolOutcome
  let ok = false
  if (!tool) {
    outcome = { data: { error: `Unknown tool "${name}"` } }
  } else if (tool.writes && !hasPermission(ctx.role, 'content:create')) {
    outcome = { data: { error: 'The user has view-only access and cannot create content' } }
  } else {
    let args: Args = {}
    try {
      const parsed = JSON.parse(rawArguments || '{}')
      args = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
    } catch {
      outcome = { data: { error: 'Tool arguments were not valid JSON' } }
      return { ...outcome, ok, content: JSON.stringify(outcome.data) }
    }

    try {
      outcome = await tool.execute(ctx, args)
      ok = true
    } catch (error) {
      if (error instanceof ServiceError) {
        outcome = { data: { error: error.message } }
      } else {
        console.error(`AI tool ${name} failed:`, error)
        const known = error instanceof Prisma.PrismaClientKnownRequestError
        outcome = { data: { error: known ? 'The record could not be saved' : `${tool.label} failed` } }
      }
    }
  }

  return { ...outcome, ok, content: truncate(JSON.stringify(outcome.data), MAX_RESULT_CHARS) }
}
