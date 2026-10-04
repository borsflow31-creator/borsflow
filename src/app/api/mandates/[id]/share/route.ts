import { NextRequest, NextResponse } from 'next/server'
import { getMandateAccess } from '@/lib/crm/access'
import { mintToken } from '@/lib/crm/public-links'
import { failure } from '@/lib/api/respond'

// POST /api/mandates/[id]/share  { rotate? } — mint or rotate the vendor report link.
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const result = await getMandateAccess(params.id, { write: true })
    if ('error' in result) return result.error

    // `rotate` issues a fresh token, which is what revokes a link already sent.
    const body = await request.json().catch(() => ({}))
    const { token, url } = await mintToken('mandate', params.id, { rotate: body?.rotate === true })
    return NextResponse.json({ token, url })
  } catch (error) {
    return failure(error, 'Failed to create share link', 'Error sharing mandate')
  }
}
