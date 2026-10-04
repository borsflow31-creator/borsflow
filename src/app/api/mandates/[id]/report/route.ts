import { NextRequest, NextResponse } from 'next/server'
import { getMandateAccess } from '@/lib/crm/access'
import { buildVendorReport } from '@/lib/crm/vendor-report'
import { failure } from '@/lib/api/respond'

export const dynamic = 'force-dynamic'

// GET /api/mandates/[id]/report — what the vendor will see, for the agent to check first.
export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const result = await getMandateAccess(params.id)
    if ('error' in result) return result.error

    const report = await buildVendorReport(params.id)
    if (!report) return NextResponse.json({ error: 'Mandate not found' }, { status: 404 })
    return NextResponse.json({ report })
  } catch (error) {
    return failure(error, 'Failed to build the report', 'Error building vendor report')
  }
}
