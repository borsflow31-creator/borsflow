import { capacityError } from '@/lib/billing/capacity'
import { NextRequest, NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getWorkspaceAccess } from '@/lib/crm/access'
import { signMediaPaths } from '@/lib/crm/media-urls'
import { PROPERTY_STATUSES, isPropertyType } from '@/lib/crm/lifecycle'
import { createProperty, propertyInclude } from '@/lib/services/properties'
import { failure, readBody, INVALID_BODY } from '@/lib/api/respond'
import { clampInt, toOptionalNumber } from '@/lib/products'

export const dynamic = 'force-dynamic'

const SORTS: Record<string, Prisma.PropertyOrderByWithRelationInput[]> = {
  newest: [{ createdAt: 'desc' }],
  price_asc: [{ price: 'asc' }],
  price_desc: [{ price: 'desc' }],
  oldest_listing: [{ listedAt: { sort: 'asc', nulls: 'last' } }],
}

// GET /api/properties?workspaceId=…
// Filters: q, status (comma list), type, city, minPrice, maxPrice, minBedrooms,
// vendorId, ownerId, sort, page, limit. With pipelineId it returns the whole owner
// board unpaginated instead, since a board needs every card in every column.
export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams
    const workspaceId = params.get('workspaceId')
    if (!workspaceId) return NextResponse.json({ error: 'Workspace ID is required' }, { status: 400 })

    const result = await getWorkspaceAccess(workspaceId)
    if ('error' in result) return result.error
    const { access } = result

    const where: Prisma.PropertyWhereInput = { workspaceId }

    const pipelineId = params.get('pipelineId')
    if (pipelineId) where.pipelineId = pipelineId

    const q = params.get('q')?.trim()
    if (q) {
      where.OR = ['title', 'reference', 'city', 'district', 'addressLine'].map(field => ({
        [field]: { contains: q, mode: 'insensitive' },
      })) as Prisma.PropertyWhereInput[]
    }

    const statuses = (params.get('status') ?? '').split(',').filter(s => (PROPERTY_STATUSES as readonly string[]).includes(s))
    if (statuses.length) where.status = { in: statuses }

    const type = params.get('type')
    if (isPropertyType(type)) where.propertyType = type

    const city = params.get('city')?.trim()
    if (city) where.city = { equals: city, mode: 'insensitive' }

    const minPrice = toOptionalNumber(params.get('minPrice'))
    const maxPrice = toOptionalNumber(params.get('maxPrice'))
    if (minPrice !== null || maxPrice !== null) {
      where.price = { ...(minPrice !== null ? { gte: minPrice } : {}), ...(maxPrice !== null ? { lte: maxPrice } : {}) }
    }

    const minBedrooms = toOptionalNumber(params.get('minBedrooms'))
    if (minBedrooms !== null) where.bedrooms = { gte: minBedrooms }

    const vendorId = params.get('vendorId')
    if (vendorId) where.vendorId = vendorId
    const ownerId = params.get('ownerId')
    if (ownerId) where.ownerId = ownerId

    const board = Boolean(pipelineId)
    const limit = board ? 1000 : clampInt(params.get('limit'), 24, 1, 100)
    const page = board ? 1 : clampInt(params.get('page'), 1, 1, 10_000)
    const orderBy = board
      ? [{ order: 'asc' as const }, { createdAt: 'asc' as const }]
      : SORTS[params.get('sort') ?? ''] ?? SORTS.newest

    const [rows, total, cities] = await Promise.all([
      prisma.property.findMany({
        where,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
        include: {
          ...propertyInclude,
          media: {
            where: { kind: 'photo', filePath: { not: null } },
            orderBy: [{ isCover: 'desc' }, { position: 'asc' }],
            take: 1,
            select: { filePath: true },
          },
        },
      }),
      prisma.property.count({ where }),
      // For the city filter: the cities this agency actually has listings in.
      board
        ? Promise.resolve([])
        : prisma.property.findMany({ where: { workspaceId }, distinct: ['city'], select: { city: true }, orderBy: { city: 'asc' } }),
    ])

    const urls = await signMediaPaths(rows.map(r => r.media[0]?.filePath))
    const properties = rows.map(({ media, ...row }) => ({
      ...row,
      coverUrl: media[0]?.filePath ? urls.get(media[0].filePath) ?? null : null,
    }))

    return NextResponse.json({
      properties,
      cities: cities.map(c => c.city),
      pagination: { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) },
      role: access.role,
      canWrite: access.role !== 'viewer',
    })
  } catch (error) {
    return failure(error, 'Failed to fetch properties', 'Error fetching properties')
  }
}

// POST /api/properties  { workspaceId, title, city, … }
export async function POST(request: NextRequest) {
  try {
    const body = await readBody(request)
    if (!body) return INVALID_BODY()
    const workspaceId = typeof body.workspaceId === 'string' ? body.workspaceId : ''
    if (!workspaceId) return NextResponse.json({ error: 'Workspace ID is required' }, { status: 400 })

    const result = await getWorkspaceAccess(workspaceId, { write: true })
    if ('error' in result) return result.error
    const { access } = result

    const full = await capacityError(workspaceId, 'properties')
    if (full) return full

    const property = await createProperty({ workspaceId, userId: access.userId }, body)
    return NextResponse.json({ property }, { status: 201 })
  } catch (error) {
    return failure(error, 'Failed to create property', 'Error creating property')
  }
}
