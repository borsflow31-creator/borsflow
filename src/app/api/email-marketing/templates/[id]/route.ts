import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireWorkspaceAccess, requireWorkspacePermission } from '@/lib/api/workspace'

/**
 * Authorizes against the workspace that owns the template, never a workspace id
 * from the request. `write` additionally requires permission to change content,
 * so viewers stay read-only.
 */
async function authorize(id: string, write: boolean) {
  const template = await prisma.emailTemplate.findUnique({
    where: { id },
    select: { workspaceId: true },
  })
  if (!template) return { error: 'Template not found', status: 404 as const }

  return write
    ? requireWorkspacePermission(template.workspaceId, 'content:create')
    : requireWorkspaceAccess(template.workspaceId)
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const access = await authorize(params.id, false)
    if ('error' in access) {
      return NextResponse.json({ error: access.error }, { status: access.status })
    }

    const template = await prisma.emailTemplate.findUnique({
      where: { id: params.id }
    })
    return NextResponse.json({ template })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch template' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const access = await authorize(params.id, true)
    if ('error' in access) {
      return NextResponse.json({ error: access.error }, { status: access.status })
    }

    const body = await request.json()

    const { name, description, type, subject, htmlContent, textContent, variables, tags, isActive, isDefault } = body

    const data: Record<string, any> = {}
    if (name !== undefined) data.name = name
    if (description !== undefined) data.description = description
    if (type !== undefined) data.type = type
    if (subject !== undefined) data.subject = subject
    if (htmlContent !== undefined) data.htmlContent = htmlContent
    if (textContent !== undefined) data.textContent = textContent
    if (isActive !== undefined) data.isActive = isActive
    if (isDefault !== undefined) data.isDefault = isDefault
    if (variables !== undefined) data.variables = Array.isArray(variables) ? JSON.stringify(variables) : variables
    if (tags !== undefined) data.tags = Array.isArray(tags) ? JSON.stringify(tags) : tags

    const template = await prisma.emailTemplate.update({
      where: { id: params.id },
      data
    })
    return NextResponse.json({ template })
  } catch (error: any) {
    console.error('Error updating template:', error)
    return NextResponse.json({ error: 'Failed to update template' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const access = await authorize(params.id, true)
    if ('error' in access) {
      return NextResponse.json({ error: access.error }, { status: access.status })
    }

    await prisma.emailTemplate.delete({
      where: { id: params.id }
    })
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete template' }, { status: 500 })
  }
}
