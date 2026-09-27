import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

async function getTemplateAndCheckAccess(
  templateId: string,
  userId: string,
  requireWriteAccess = false
) {
  const template = await prisma.universalTemplate.findUnique({
    where: { id: templateId },
    include: {
      category: { select: { id: true, name: true, slug: true, icon: true } },
    },
  })

  if (!template) return { template: null, error: 'Template not found', status: 404 }

  // System templates are readable by all authenticated users
  if (template.isSystem) {
    if (requireWriteAccess) {
      return { template: null, error: 'System templates cannot be modified', status: 403 }
    }
    return { template, error: null, status: 200 }
  }

  // Workspace templates require membership
  if (template.workspaceId) {
    const workspace = await prisma.workspace.findFirst({
      where: {
        id: template.workspaceId,
        OR: [
          { ownerId: userId },
          { members: { some: { userId } } },
        ],
      },
      include: { members: { where: { userId } } },
    })

    if (!workspace) return { template: null, error: 'Access denied', status: 403 }

    if (requireWriteAccess) {
      const isOwner = workspace.ownerId === userId
      const memberRole = workspace.members[0]?.role
      if (!isOwner && memberRole !== 'admin') {
        return { template: null, error: 'Only owners and admins can modify templates', status: 403 }
      }
    }

    return { template, error: null, status: 200 }
  }

  return { template: null, error: 'Access denied', status: 403 }
}

// GET /api/templates/[id]
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { template, error, status } = await getTemplateAndCheckAccess(params.id, session.user.id)
    if (error) return NextResponse.json({ error }, { status })

    return NextResponse.json({ template })
  } catch (error) {
    console.error('Error fetching template:', error)
    return NextResponse.json({ error: 'Failed to fetch template' }, { status: 500 })
  }
}

// PUT /api/templates/[id]
export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { template, error, status } = await getTemplateAndCheckAccess(
      params.id,
      session.user.id,
      true
    )
    if (error) return NextResponse.json({ error }, { status })

    const body = await request.json()
    const { name, description, content, categoryId, icon, tags, isPublic } = body

    const updated = await prisma.universalTemplate.update({
      where: { id: params.id },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(content !== undefined && {
          content: typeof content === 'string' ? content : JSON.stringify(content),
        }),
        ...(categoryId !== undefined && { categoryId }),
        ...(icon !== undefined && { icon }),
        ...(tags !== undefined && {
          tags: Array.isArray(tags) ? JSON.stringify(tags) : tags,
        }),
        ...(isPublic !== undefined && { isPublic }),
        // immutable: isSystem, type, workspaceId — never updated via API
      },
      include: {
        category: { select: { id: true, name: true, slug: true, icon: true } },
      },
    })

    return NextResponse.json({ template: updated })
  } catch (error) {
    console.error('Error updating template:', error)
    return NextResponse.json({ error: 'Failed to update template' }, { status: 500 })
  }
}

// DELETE /api/templates/[id]
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { error, status } = await getTemplateAndCheckAccess(params.id, session.user.id, true)
    if (error) return NextResponse.json({ error }, { status })

    await prisma.universalTemplate.delete({ where: { id: params.id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting template:', error)
    return NextResponse.json({ error: 'Failed to delete template' }, { status: 500 })
  }
}
