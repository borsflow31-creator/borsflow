import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET /api/templates - List templates
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const workspaceId = searchParams.get('workspaceId')
    const type = searchParams.get('type')
    const categoryId = searchParams.get('categoryId')
    const search = searchParams.get('search')
    const scope = searchParams.get('scope') || 'all' // 'system' | 'workspace' | 'all'

    // Build where clause — workspaceId is optional; without it we return system templates only
    const where: any = {}

    if (!workspaceId) {
      // No workspace: return system templates only (always public)
      where.isSystem = true
    } else {
      // Verify workspace access
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
        return NextResponse.json({ error: 'Access denied' }, { status: 403 })
      }

      if (scope === 'system') {
        where.isSystem = true
      } else if (scope === 'workspace') {
        where.workspaceId = workspaceId
      } else {
        // all: system templates + workspace-specific templates
        where.OR = [{ isSystem: true }, { workspaceId }]
      }
    }

    if (type) {
      where.type = type
    }

    if (categoryId) {
      where.categoryId = categoryId
    }

    if (search) {
      const searchCondition = [
        { name: { contains: search } },
        { description: { contains: search } },
      ]
      // Merge with existing OR if present
      if (where.OR) {
        where.AND = [{ OR: where.OR }, { OR: searchCondition }]
        delete where.OR
      } else {
        where.OR = searchCondition
      }
    }

    const [templates, categories] = await Promise.all([
      prisma.universalTemplate.findMany({
        where,
        include: {
          category: { select: { id: true, name: true, slug: true, icon: true } },
        },
        orderBy: [{ isSystem: 'desc' }, { usageCount: 'desc' }, { createdAt: 'desc' }],
      }),
      prisma.templateCategory.findMany({
        orderBy: { order: 'asc' },
      }),
    ])

    return NextResponse.json({ templates, categories })
  } catch (error) {
    console.error('Error fetching templates:', error)
    return NextResponse.json({ error: 'Failed to fetch templates' }, { status: 500 })
  }
}

// POST /api/templates - Create workspace template
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { workspaceId, name, description, type, content, categoryId, icon, tags, isPublic } = body

    if (!workspaceId || !name || !type) {
      return NextResponse.json(
        { error: 'workspaceId, name, and type are required' },
        { status: 400 }
      )
    }

    const validTypes = ['page', 'quote', 'invoice', 'kanban']
    if (!validTypes.includes(type)) {
      return NextResponse.json({ error: `type must be one of: ${validTypes.join(', ')}` }, { status: 400 })
    }

    // Verify workspace access and role
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

    // Only owner or admin can create templates
    const isOwner = workspace.ownerId === session.user.id
    const memberRole = workspace.members[0]?.role
    if (!isOwner && !['admin'].includes(memberRole)) {
      return NextResponse.json({ error: 'Only owners and admins can create templates' }, { status: 403 })
    }

    const template = await prisma.universalTemplate.create({
      data: {
        name,
        description: description || null,
        type,
        categoryId: categoryId || null,
        workspaceId,
        isSystem: false, // never settable via API
        isPublic: isPublic || false,
        content: typeof content === 'string' ? content : JSON.stringify(content || {}),
        icon: icon || null,
        tags: Array.isArray(tags) ? JSON.stringify(tags) : tags || null,
        createdById: session.user.id,
      },
      include: {
        category: { select: { id: true, name: true, slug: true, icon: true } },
      },
    })

    return NextResponse.json({ template }, { status: 201 })
  } catch (error) {
    console.error('Error creating template:', error)
    return NextResponse.json({ error: 'Failed to create template' }, { status: 500 })
  }
}
