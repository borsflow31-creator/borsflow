import { NextRequest, NextResponse } from 'next/server'
import { getOfferAccess } from '@/lib/crm/access'
import { mintToken } from '@/lib/crm/public-links'
import { failure } from '@/lib/api/respond'

// POST /api/offers/[id]/share  { rotate? } — the link where the vendor accepts or declines.
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const result = await getOfferAccess(params.id, { write: true })
    if ('error' in result) return result.error

    const body = await request.json().catch(() => ({}))
    const { token, url } = await mintToken('offer', params.id, { rotate: body?.rotate === true })
    return NextResponse.json({ token, url })
  } catch (error) {
    return failure(error, 'Failed to create share link', 'Error sharing offer')
  }
}
