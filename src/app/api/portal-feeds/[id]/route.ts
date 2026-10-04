import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getWorkspaceAccess } from '@/lib/crm/access'
import { generatePublicToken } from '@/lib/documents/share'
import { failure, readBody, INVALID_BODY } from '@/lib/api/respond'

type Params = { params: { id: string } }

async function authorize(id: string) {
  const feed = await prisma.portalFeed.findUnique({ where: { id }, select: { workspaceId: true } })
  if (!feed) return { error: NextResponse.json({ error: 'Portal feed not found' }, { status: 404 }) }
  const result = await getWorkspaceAccess(feed.workspaceId, { write: true })
  if ('error' in result) return result
  if (!result.access.canModerate) {
    return { error: NextResponse.json({ error: 'Only an owner or admin can change a portal feed' }, { status: 403 }) }
  }
  return { access: result.access }
}

// PUT /api/portal-feeds/[id]  { name?, isActive?, rotate?, includeUnpublished?, filter… }
// `rotate: true` issues a new token, which is what revokes a portal's access to the old URL.
export async function PUT(request: NextRequest, { params }: Params) {
  try {
    const auth = await authorize(params.id)
    if ('error' in auth) return auth.error

    const body = await readBody(request)
    if (!body) return INVALID_BODY()
    const list = (v: unknown) => (Array.isArray(v) && v.length ? JSON.stringify(v.filter((x): x is string => typeof x === 'string')) : null)

    const feed = await prisma.portalFeed.update({
      where: { id: params.id },
      data: {
        ...(typeof body.name === 'string' && body.name.trim() ? { name: body.name.trim().slice(0, 100) } : {}),
        ...(typeof body.isActive === 'boolean' ? { isActive: body.isActive } : {}),
        ...(typeof body.includeUnpublished === 'boolean' ? { includeUnpublished: body.includeUnpublished } : {}),
        ...(body.filterStatuses !== undefined ? { filterStatuses: list(body.filterStatuses) } : {}),
        ...(body.filterPropertyTypes !== undefined ? { filterPropertyTypes: list(body.filterPropertyTypes) } : {}),
        ...(body.filterCities !== undefined ? { filterCities: list(body.filterCities) } : {}),
        ...(body.rotate === true ? { token: generatePublicToken(), tokenCreatedAt: new Date() } : {}),
      },
    })
    const { token: _token, ...rest } = feed
    return NextResponse.json({ feed: { ...rest, url: `${(process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '')}/api/public/portal-feed/${feed.token}` } })
  } catch (error) {
    return failure(error, 'Failed to update the portal feed', 'Error updating portal feed')
  }
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  try {
    const auth = await authorize(params.id)
    if ('error' in auth) return auth.error
    await prisma.portalFeed.delete({ where: { id: params.id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    return failure(error, 'Failed to delete the portal feed', 'Error deleting portal feed')
  }
}
