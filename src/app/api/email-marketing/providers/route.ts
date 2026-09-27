import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { emailMarketingService } from '@/lib/email-marketing'
import { requireWorkspaceAccess, requireWorkspacePermission } from '@/lib/api/workspace'
import { isSupportedProviderType, sealApiKey, SUPPORTED_PROVIDER_TYPES } from '@/lib/email/provider-keys'
import { presentProvider } from '@/lib/email/present-provider'
import { connectProviderWebhook, webhookBaseUrl } from '@/lib/email/webhook-setup'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const workspaceId = searchParams.get('workspaceId')

  if (!workspaceId) {
    return NextResponse.json({ error: 'Workspace ID is required' }, { status: 400 })
  }

  try {
    const access = await requireWorkspaceAccess(workspaceId)
    if ('error' in access) {
      return NextResponse.json({ error: access.error }, { status: access.status })
    }

    let providers = await prisma.emailProvider.findMany({
      where: { workspaceId }
    })

    // Finish tracking setup that couldn't happen at save time: providers saved
    // before it was automatic, or while BorsFlow wasn't on its public address.
    // Nothing for the client to click.
    const pending = providers.filter(p => !p.webhookStatus || p.webhookStatus === 'waiting_public_url')
    if (pending.length > 0 && webhookBaseUrl()) {
      for (const p of pending) {
        await connectProviderWebhook(p.id).catch(err => console.error('[providers] tracking setup failed:', err))
      }
      providers = await prisma.emailProvider.findMany({ where: { workspaceId } })
    }

    return NextResponse.json({ providers: providers.map(presentProvider) })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch providers' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { workspaceId, name, type, apiKey, region, fromEmail, fromName, replyTo, isDefault } = body

  if (!workspaceId || !type || !apiKey || !fromEmail) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  if (!isSupportedProviderType(type)) {
    return NextResponse.json(
      { error: `Unsupported provider type. Choose one of: ${SUPPORTED_PROVIDER_TYPES.join(', ')}` },
      { status: 400 }
    )
  }

  try {
    const access = await requireWorkspacePermission(workspaceId, 'content:create')
    if ('error' in access) {
      return NextResponse.json({ error: access.error }, { status: access.status })
    }

    if (isDefault) {
      await prisma.emailProvider.updateMany({
        where: { workspaceId, isDefault: true },
        data: { isDefault: false }
      })
    }

    const provider = await prisma.emailProvider.create({
      data: {
        workspaceId,
        name: name || type,
        type,
        apiKey: sealApiKey(apiKey),
        region: region || null,
        fromEmail,
        fromName,
        replyTo,
        isDefault: isDefault || false,
        isActive: true,
        createdById: access.session.user.id,
      }
    })

    // Create the bounce/complaint webhook on the client's own account now, so
    // there is nothing for them to copy between dashboards. A failure is saved as
    // a status the UI explains; the provider itself is saved either way.
    const connected = await connectProviderWebhook(provider.id)

    await emailMarketingService.loadProviders(workspaceId)

    return NextResponse.json({ provider: presentProvider(connected ?? provider) }, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create provider' }, { status: 500 })
  }
}
