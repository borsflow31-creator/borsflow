import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { calculateDocumentTotals, buildItemCreateData } from '@/lib/documents/calculations'
import { createWithDocumentNumber } from '@/lib/documents/numbering'

// POST /api/templates/[id]/apply
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { workspaceId, contentOverride } = body

    if (!workspaceId) {
      return NextResponse.json({ error: 'workspaceId is required' }, { status: 400 })
    }

    // Verify workspace access (members can apply, viewers cannot)
    const workspace = await prisma.workspace.findFirst({
      where: {
        id: workspaceId,
        OR: [
          { ownerId: session.user.id },
          { members: { some: { userId: session.user.id } } },
        ],
      },
      include: { members: { where: { userId: session.user.id } } },
    })

    if (!workspace) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Viewers cannot apply templates
    const isOwner = workspace.ownerId === session.user.id
    const memberRole = workspace.members[0]?.role
    if (!isOwner && memberRole === 'viewer') {
      return NextResponse.json({ error: 'Viewers cannot apply templates' }, { status: 403 })
    }

    // Fetch the template
    const template = await prisma.universalTemplate.findUnique({
      where: { id: params.id },
    })

    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 })
    }

    // If it's a workspace template, verify it belongs to this workspace or is public
    if (!template.isSystem && template.workspaceId !== workspaceId && !template.isPublic) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Parse content — contentOverride (from AI generation) takes precedence
    let content: any = {}
    try {
      const raw = contentOverride || template.content
      content = typeof raw === 'string' ? JSON.parse(raw) : raw
    } catch {
      content = {}
    }

    let redirect = '/'

    // ─── PAGE ─────────────────────────────────────────────────────────────────
    if (template.type === 'page') {
      const title = content.title || template.name
      const icon = content.icon || template.icon || null
      const blocks: any[] = content.blocks || []

      const page = await prisma.page.create({
        data: {
          title,
          icon,
          workspaceId,
          content: JSON.stringify({ blocks }),
          createdById: session.user.id,
        },
      })

      // Create individual Block records if blocks are present
      if (blocks.length > 0) {
        await prisma.block.createMany({
          data: blocks.map((block: any, index: number) => ({
            pageId: page.id,
            type: block.type || 'text',
            content: typeof block.content === 'string'
              ? block.content
              : JSON.stringify(block.content || {}),
            order: index,
            createdById: session.user.id,
          })),
        })
      }

      redirect = `/pages/${page.id}`
    }

    // ─── QUOTE ────────────────────────────────────────────────────────────────
    else if (template.type === 'quote') {
      const items: any[] = content.items || []
      const taxRate = content.taxRate || 0
      const currency = content.currency || 'USD'

      // Template items carry their own per-line discount and tax, which this route
      // used to drop on the floor with a third totals formula of its own.
      const normalizedItems = items.map((item: any) => ({
        description: item.description || 'Item',
        quantity: item.quantity || 1,
        unitPrice: item.unitPrice || 0,
        discount: item.discount || 0,
        taxRate: item.taxRate || 0,
      }))
      const totals = calculateDocumentTotals(normalizedItems, { taxRate })

      const quote = await createWithDocumentNumber('quote', workspaceId, (quoteNumber) =>
        prisma.quote.create({
          data: {
            quoteNumber,
            workspaceId,
            clientName: 'Client Name',
            currency,
            subtotal: totals.subtotal,
            taxRate,
            taxAmount: totals.taxAmount,
            discountValue: 0,
            discountAmount: totals.discountAmount,
            total: totals.total,
            notes: content.notes || null,
            terms: content.terms || null,
            status: 'draft',
            createdById: session.user.id,
            items: { create: buildItemCreateData(normalizedItems) },
          },
        })
      )

      redirect = `/quotes/${quote.id}`
    }

    // ─── INVOICE ──────────────────────────────────────────────────────────────
    else if (template.type === 'invoice') {
      const items: any[] = content.items || []
      const taxRate = content.taxRate || 0
      const currency = content.currency || 'USD'

      const normalizedItems = items.map((item: any) => ({
        description: item.description || 'Item',
        quantity: item.quantity || 1,
        unitPrice: item.unitPrice || 0,
        discount: item.discount || 0,
        taxRate: item.taxRate || 0,
      }))
      const totals = calculateDocumentTotals(normalizedItems, { taxRate })

      const invoice = await createWithDocumentNumber('invoice', workspaceId, (invoiceNumber) =>
        prisma.invoice.create({
          data: {
            invoiceNumber,
            workspaceId,
            clientName: 'Client Name',
            currency,
            subtotal: totals.subtotal,
            taxRate,
            taxAmount: totals.taxAmount,
            discountValue: 0,
            discountAmount: totals.discountAmount,
            total: totals.total,
            amountPaid: 0,
            amountDue: totals.total,
            notes: content.notes || null,
            terms: content.terms || null,
            status: 'draft',
            createdById: session.user.id,
            items: { create: buildItemCreateData(normalizedItems) },
          },
        })
      )

      redirect = `/invoices/${invoice.id}`
    }

    // ─── KANBAN ───────────────────────────────────────────────────────────────
    else if (template.type === 'kanban') {
      const cards: any[] = content.cards || []

      const project = await prisma.kanbanProject.create({
        data: {
          name: content.projectName || template.name,
          description: content.description || null,
          color: content.projectColor || '#6366f1',
          workspaceId,
          createdById: session.user.id,
        },
      })

      if (cards.length > 0) {
        await prisma.kanbanCard.createMany({
          data: cards.map((card: any, index: number) => ({
            title: card.title || 'Untitled',
            description: card.description || null,
            status: card.status || 'todo',
            priority: card.priority || 'medium',
            workspaceId,
            projectId: project.id,
            order: index,
            createdById: session.user.id,
          })),
        })
      }

      redirect = `/kanban-board-view?workspace=${workspaceId}&project=${project.id}`
    } else {
      return NextResponse.json({ error: `Unknown template type: ${template.type}` }, { status: 400 })
    }

    // Increment usage count (fire-and-forget style — don't block the response)
    prisma.universalTemplate.update({
      where: { id: params.id },
      data: { usageCount: { increment: 1 } },
    }).catch(() => {}) // non-critical

    return NextResponse.json({ redirect })
  } catch (error) {
    console.error('Error applying template:', error)
    return NextResponse.json({ error: 'Failed to apply template' }, { status: 500 })
  }
}
