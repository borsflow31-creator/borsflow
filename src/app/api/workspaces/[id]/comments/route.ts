import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireWorkspaceAccess } from '@/lib/api/workspace'
import { getAccessiblePageIds, getUserPageAccess } from '@/lib/workspace'

/*
 * Access is owner-or-member (requireWorkspaceAccess). This route used to accept
 * only WorkspaceMember rows, and the owner has none, so the workspace owner could
 * neither read nor post comments on their own pages.
 *
 * Comments on a page follow the page's own access: a member without a grant on a
 * page must not read its comments, the same as its content.
 */

/** True when `pageId` is in this workspace and the user may open it. */
async function canUsePage(pageId: string, workspaceId: string, userId: string) {
  const page = await prisma.page.findFirst({ where: { id: pageId, workspaceId }, select: { id: true } })
  if (!page) return false
  return (await getUserPageAccess(pageId, userId, workspaceId)) !== 'NONE'
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const access = await requireWorkspaceAccess(params.id)
    if ('error' in access) {
      return NextResponse.json({ error: access.error }, { status: access.status })
    }
    const userId = access.session.user.id

    const pageId = request.nextUrl.searchParams.get('pageId')

    let pageFilter: Record<string, unknown> = {}
    if (pageId) {
      if (!(await canUsePage(pageId, params.id, userId))) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 })
      }
      pageFilter = { pageId }
    } else {
      // No page given: only comments on pages this user can open (or none at all).
      const accessible = await getAccessiblePageIds(params.id, userId)
      if (accessible !== null) {
        pageFilter = { OR: [{ pageId: null }, { pageId: { in: accessible } }] }
      }
    }

    const comments = await prisma.comment.findMany({
      where: {
        workspaceId: params.id,
        resolved: false,
        parentId: null, // Only get top-level comments
        ...pageFilter,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        replies: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
          orderBy: {
            createdAt: 'asc',
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    return NextResponse.json({ comments })
  } catch (error) {
    console.error('Error fetching comments:', error)
    return NextResponse.json({ error: 'Failed to fetch comments' }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const access = await requireWorkspaceAccess(params.id)
    if ('error' in access) {
      return NextResponse.json({ error: access.error }, { status: access.status })
    }
    const userId = access.session.user.id

    const body = await request.json()
    const { content, blockId, pageId, parentId } = body

    if (!content) {
      return NextResponse.json({ error: 'Content is required' }, { status: 400 })
    }

    // The page (and the thread being replied to) must belong to this workspace
    // and be one the user can open.
    if (pageId && !(await canUsePage(pageId, params.id, userId))) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }
    if (parentId) {
      const parent = await prisma.comment.findFirst({ where: { id: parentId, workspaceId: params.id }, select: { id: true } })
      if (!parent) {
        return NextResponse.json({ error: 'Comment not found in this workspace' }, { status: 400 })
      }
    }

    const comment = await prisma.comment.create({
      data: {
        content,
        workspaceId: params.id,
        userId,
        blockId,
        pageId,
        parentId,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    })

    return NextResponse.json({ comment }, { status: 201 })
  } catch (error) {
    console.error('Error creating comment:', error)
    return NextResponse.json({ error: 'Failed to create comment' }, { status: 500 })
  }
}
