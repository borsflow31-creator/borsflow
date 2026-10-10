import { NextRequest, NextResponse } from 'next/server'
import { getDeveloperAccess } from '@/lib/crm/access'
import { failure } from '@/lib/api/respond'
import { listInventory } from '@/lib/services/developer/lots'

export const dynamic = 'force-dynamic'

/** A price filter that is not a number is ignored rather than failing the page. */
function readPrice(value: string | null): number | undefined {
  if (value === null || value.trim() === '') return undefined
  const n = Number(value)
  return Number.isFinite(n) && n >= 0 ? n : undefined
}

/** Every unit in the workspace, filtered, for the inventory page. */
export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams
    const workspaceId = params.get('workspaceId')
    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace ID is required' }, { status: 400 })
    }

    const result = await getDeveloperAccess(workspaceId)
    if ('error' in result) return result.error
    const { access } = result

    const lots = await listInventory(
      { workspaceId, userId: access.userId },
      {
        programId: params.get('programId') || undefined,
        buildingId: params.get('buildingId') || undefined,
        status: params.get('status') || undefined,
        type: params.get('type') || undefined,
        agentId: params.get('agentId') || undefined,
        minPrice: readPrice(params.get('minPrice')),
        maxPrice: readPrice(params.get('maxPrice')),
      }
    )
    return NextResponse.json({ lots })
  } catch (error) {
    return failure(error, 'Failed to fetch inventory', 'Error fetching inventory')
  }
}
