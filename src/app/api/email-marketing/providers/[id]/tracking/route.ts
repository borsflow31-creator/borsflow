import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireWorkspacePermission } from '@/lib/api/workspace'
import { presentProvider } from '@/lib/email/present-provider'
import { connectProviderWebhook } from '@/lib/email/webhook-setup'

/**
 * POST: (re)create the bounce/complaint webhook on the client's provider account.
 * Backs the "Retry" button shown when automatic setup could not finish.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const existing = await prisma.emailProvider.findUnique({
    where: { id: params.id },
    select: { workspaceId: true },
  })
  if (!existing) return NextResponse.json({ error: 'Provider not found' }, { status: 404 })

  const access = await requireWorkspacePermission(existing.workspaceId, 'content:create')
  if ('error' in access) {
    return NextResponse.json({ error: access.error }, { status: access.status })
  }

  const provider = await connectProviderWebhook(params.id)
  if (!provider) return NextResponse.json({ error: 'Provider not found' }, { status: 404 })

  return NextResponse.json({ provider: presentProvider(provider) })
}
