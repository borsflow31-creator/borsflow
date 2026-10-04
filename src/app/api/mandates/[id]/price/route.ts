import { NextRequest, NextResponse } from 'next/server'
import { getMandateAccess } from '@/lib/crm/access'
import { changeAskingPrice } from '@/lib/services/mandates'
import { failure, readBody, INVALID_BODY } from '@/lib/api/respond'

// POST /api/mandates/[id]/price  { price, reason? }
// Records a price change in the mandate's history and moves the property's price
// to match. Days-on-market and price drops are what every seller asks about.
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const result = await getMandateAccess(params.id, { write: true })
    if ('error' in result) return result.error
    const { access } = result

    const body = await readBody(request)
    if (!body) return INVALID_BODY()

    const mandate = await changeAskingPrice(params.id, { workspaceId: access.workspaceId, userId: access.userId }, body)
    return NextResponse.json({ mandate })
  } catch (error) {
    return failure(error, 'Failed to change the price', 'Error changing mandate price')
  }
}
