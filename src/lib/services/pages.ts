import { prisma } from '@/lib/prisma'
import type { Role } from '@/lib/workspace'
import { ServiceError } from './errors'

export interface PageBlockInput {
  type: string
  text: string
}

/**
 * Create a page. The caller must already have checked that `userId` may create
 * content in `workspaceId` and passes the role that check resolved.
 */
export async function createPage(params: {
  workspaceId: string
  userId: string
  role: Role
  title: string
  parentId?: string | null
  icon?: string | null
  coverImage?: string | null
  /** Initial blocks, e.g. from the AI assistant. Empty page when omitted. */
  blocks?: PageBlockInput[]
}) {
  const { workspaceId, userId, role, title, parentId, icon, coverImage, blocks } = params

  // A sub-page must live in the same workspace as its parent. Otherwise a
  // page from one workspace could be attached under another workspace's
  // page and show up in that workspace's sidebar.
  if (parentId) {
    const parent = await prisma.page.findFirst({
      where: { id: parentId, workspaceId },
      select: { id: true },
    })
    if (!parent) {
      throw new ServiceError('Parent page not found in this workspace')
    }
  }

  // Get the maximum order for pages in this workspace/parent
  const maxOrder = await prisma.page.findFirst({
    where: { workspaceId, parentId: parentId || null },
    orderBy: { order: 'desc' },
    select: { order: true },
  })

  // Same shape the editor saves ({ type: 'doc', blocks }); with no Block rows yet
  // the editor loads the page from this JSON.
  const content = blocks && blocks.length > 0
    ? {
        type: 'doc',
        blocks: blocks.map((block, order) => ({
          id: `blk_${Date.now().toString(36)}_${order}`,
          type: block.type,
          content: { text: block.text },
          order,
        })),
      }
    : { type: 'doc', content: [] }

  const page = await prisma.page.create({
    data: {
      title,
      workspaceId,
      parentId: parentId || null,
      icon: icon || null,
      coverImage: coverImage || null,
      createdById: userId,
      order: (maxOrder?.order || 0) + 1,
      content: JSON.stringify(content),
    },
  })

  // Members only see pages they hold a grant for, and nothing granted one to
  // the creator, so a member could not open the page they had just made.
  // Owners and admins see every page and need no grant.
  if (role === 'member') {
    await prisma.pageAccess.create({
      data: { pageId: page.id, userId, level: 'EDIT', grantedBy: userId },
    })
  }

  return page
}
