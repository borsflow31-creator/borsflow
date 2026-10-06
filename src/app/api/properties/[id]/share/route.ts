import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getPropertyAccess } from '@/lib/crm/access'
import { mintToken } from '@/lib/crm/public-links'
import { failure } from '@/lib/api/respond'

// POST /api/properties/[id]/share  { rotate?, publish? }
// Mint (or rotate) the public listing link. `publish: true` also marks the listing
// published, which is what makes the link work; the
// listing page returns nothing for an unpublished property however good the link.
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const result = await getPropertyAccess(params.id, { write: true })
    if ('error' in result) return result.error

    const body = await request.json().catch(() => ({}))
    const { token, url } = await mintToken('property', params.id, { rotate: body?.rotate === true })
    if (body?.publish === true) {
      await prisma.property.updateMany({ where: { id: params.id, isPublished: false }, data: { isPublished: true, publishedAt: new Date() } })
    }
    return NextResponse.json({ token, url })
  } catch (error) {
    return failure(error, 'Failed to create the listing link', 'Error sharing property')
  }
}
