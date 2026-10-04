import { NextRequest, NextResponse } from 'next/server'
import { failure, readBody } from '@/lib/api/respond'
import { createBuyerTMARequest } from '@/lib/services/developer/buyer-portal'

export const dynamic = 'force-dynamic'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params
    const authHeader = request.headers.get('Authorization')
    const sessionToken = authHeader?.startsWith('Bearer ')
      ? authHeader.slice(7).trim()
      : undefined

    if (!sessionToken) {
      return NextResponse.json({ error: 'Session verification required' }, { status: 401 })
    }

    const body = (await readBody(request)) as Record<string, any> | null
    if (!body || typeof body.title !== 'string' || typeof body.description !== 'string') {
      return NextResponse.json({ error: 'Title and description are required' }, { status: 400 })
    }

    const tma = await createBuyerTMARequest(token, sessionToken, {
      title: body.title,
      description: body.description,
      category: typeof body.category === 'string' ? body.category : undefined,
    })

    return NextResponse.json(tma, { status: 201 })
  } catch (error) {
    return failure(error, 'Failed to submit customization request', 'Error submitting TMA')
  }
}
