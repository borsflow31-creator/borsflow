/**
 * Email Marketing Templates API
 *
 * RESTful API endpoints for managing email templates
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireWorkspaceAccess, requireWorkspacePermission } from '@/lib/api/workspace'

// GET /api/email-marketing/templates - Get all templates for workspace
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const workspaceId = searchParams.get('workspaceId')
    const type = searchParams.get('type')

    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace ID is required' }, { status: 400 })
    }

    const access = await requireWorkspaceAccess(workspaceId)
    if ('error' in access) {
      return NextResponse.json({ error: access.error }, { status: access.status })
    }

    const whereClause: any = { workspaceId }
    if (type) {
      whereClause.type = type
    }

    const templates = await prisma.emailTemplate.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' }
    })

    return NextResponse.json({ templates })
  } catch (error) {
    console.error('Error fetching templates:', error)
    return NextResponse.json({ error: 'Failed to fetch templates' }, { status: 500 })
  }
}

// POST /api/email-marketing/templates - Create a new template
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    const { workspaceId, name, description, type, subject, htmlContent, textContent, variables, tags } = body

    if (!workspaceId || !name || !subject || !htmlContent) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const access = await requireWorkspacePermission(workspaceId, 'content:create')
    if ('error' in access) {
      return NextResponse.json({ error: access.error }, { status: access.status })
    }

    const template = await prisma.emailTemplate.create({
      data: {
        name,
        description,
        type: type || 'marketing',
        workspace: { connect: { id: workspaceId } },
        subject,
        htmlContent,
        textContent,
        variables: variables != null ? (Array.isArray(variables) ? JSON.stringify(variables) : variables) : undefined,
        isDefault: false,
        isActive: true,
        tags: tags != null ? (Array.isArray(tags) ? JSON.stringify(tags) : tags) : undefined,
        createdBy: { connect: { id: access.session.user.id } }
      }
    })

    return NextResponse.json({ template }, { status: 201 })
  } catch (error: any) {
    console.error('Error creating template:', error)
    return NextResponse.json({ error: 'Failed to create template' }, { status: 500 })
  }
}
