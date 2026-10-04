import { capacityError } from '@/lib/billing/capacity'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getWorkspaceAccess } from '@/lib/crm/access'
import { FEED_FORMATS, PORTALS, isPortal } from '@/lib/crm/portal-feed'
import { generatePublicToken } from '@/lib/documents/share'
import { failure, readBody, INVALID_BODY } from '@/lib/api/respond'
import { appUrl } from '@/lib/crm/public-listing'

export const dynamic = 'force-dynamic'

function feedUrl(token: string) {
  return `${appUrl()}/api/public/portal-feed/${token}`
}

/** A feed as the settings screen shows it. The token is the credential, so only an admin gets the URL. */
function present(feed: { token: string } & Record<string, unknown>, canSeeUrl: boolean) {
  const { token, ...rest } = feed
  return { ...rest, url: canSeeUrl ? feedUrl(token) : null }
}

// GET /api/portal-feeds?workspaceId=…
export async function GET(request: NextRequest) {
  try {
    const workspaceId = request.nextUrl.searchParams.get('workspaceId')
    if (!workspaceId) return NextResponse.json({ error: 'Workspace ID is required' }, { status: 400 })

    const result = await getWorkspaceAccess(workspaceId)
    if ('error' in result) return result.error
    const { access } = result

    const feeds = await prisma.portalFeed.findMany({ where: { workspaceId }, orderBy: { createdAt: 'desc' } })
    return NextResponse.json({
      feeds: feeds.map(f => present(f, access.canModerate)),
      canWrite: access.canModerate,
      portals: PORTALS,
    })
  } catch (error) {
    return failure(error, 'Failed to fetch portal feeds', 'Error fetching portal feeds')
  }
}

// POST /api/portal-feeds  { workspaceId, name, portal, format, filterStatuses?, … }
// Owner and admins only: a feed publishes stock to a third party.
export async function POST(request: NextRequest) {
  try {
    const body = await readBody(request)
    if (!body) return INVALID_BODY()
    const workspaceId = typeof body.workspaceId === 'string' ? body.workspaceId : ''
    if (!workspaceId) return NextResponse.json({ error: 'Workspace ID is required' }, { status: 400 })

    const result = await getWorkspaceAccess(workspaceId, { write: true })
    if ('error' in result) return result.error
    const { access } = result
    if (!access.canModerate) return NextResponse.json({ error: 'Only an owner or admin can create a portal feed' }, { status: 403 })

    const full = await capacityError(workspaceId, 'portalFeeds')
    if (full) return full

    const name = typeof body.name === 'string' ? body.name.trim().slice(0, 100) : ''
    if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    const portal = body.portal === undefined ? 'generic' : body.portal
    if (!isPortal(portal)) return NextResponse.json({ error: `Portal must be one of: ${PORTALS.join(', ')}` }, { status: 400 })
    const format = body.format === undefined ? 'xml' : body.format
    if (!(FEED_FORMATS as readonly string[]).includes(format as string)) return NextResponse.json({ error: 'Format must be xml or json' }, { status: 400 })

    const list = (v: unknown) => (Array.isArray(v) && v.length ? JSON.stringify(v.filter((x): x is string => typeof x === 'string')) : null)

    const feed = await prisma.portalFeed.create({
      data: {
        workspaceId, name, portal, format: format as string,
        token: generatePublicToken(),
        filterStatuses: list(body.filterStatuses),
        filterPropertyTypes: list(body.filterPropertyTypes),
        filterCities: list(body.filterCities),
        includeUnpublished: body.includeUnpublished === true,
        createdById: access.userId,
      },
    })
    return NextResponse.json({ feed: present(feed, true) }, { status: 201 })
  } catch (error) {
    return failure(error, 'Failed to create the portal feed', 'Error creating portal feed')
  }
}
