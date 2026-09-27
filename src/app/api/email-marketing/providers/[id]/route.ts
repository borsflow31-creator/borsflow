import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireWorkspaceAccess, requireWorkspacePermission } from '@/lib/api/workspace'
import { isSupportedProviderType, sealApiKey, SUPPORTED_PROVIDER_TYPES } from '@/lib/email/provider-keys'
import { presentProvider } from '@/lib/email/present-provider'
import { connectProviderWebhook, disconnectProviderWebhook } from '@/lib/email/webhook-setup'

/**
 * Authorizes against the workspace that owns the provider. A provider holds the
 * sending credentials and "from" address, so changing it needs content permission.
 */
async function authorize(id: string, write: boolean) {
  const provider = await prisma.emailProvider.findUnique({
    where: { id },
    select: { workspaceId: true },
  })
  if (!provider) return { error: 'Provider not found', status: 404 as const }

  return write
    ? requireWorkspacePermission(provider.workspaceId, 'content:create')
    : requireWorkspaceAccess(provider.workspaceId)
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const access = await authorize(params.id, false)
    if ('error' in access) {
      return NextResponse.json({ error: access.error }, { status: access.status })
    }

    const provider = await prisma.emailProvider.findUnique({
      where: { id: params.id }
    })
    return NextResponse.json({ provider: provider && presentProvider(provider) })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch provider' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const access = await authorize(params.id, true)
    if ('error' in access) {
      return NextResponse.json({ error: access.error }, { status: access.status })
    }

    const body = await request.json()
    const { name, type, apiKey, region, fromEmail, fromName, replyTo, isDefault, isActive, dailyLimit, monthlyLimit, config } = body

    if (type !== undefined && !isSupportedProviderType(type)) {
      return NextResponse.json(
        { error: `Unsupported provider type. Choose one of: ${SUPPORTED_PROVIDER_TYPES.join(', ')}` },
        { status: 400 }
      )
    }

    const before = await prisma.emailProvider.findUnique({ where: { id: params.id } })
    if (!before) return NextResponse.json({ error: 'Provider not found' }, { status: 404 })

    // Only replace the key when a real one was sent, not the masked placeholder
    // the UI shows back.
    const keyChanged = typeof apiKey === 'string' && apiKey !== '' && !apiKey.startsWith('****')

    const data: Record<string, any> = { updatedBy: access.session.user.id }
    if (name !== undefined) data.name = name
    if (type !== undefined) data.type = type
    if (region !== undefined) data.region = region || null
    if (fromEmail !== undefined) data.fromEmail = fromEmail
    if (fromName !== undefined) data.fromName = fromName
    if (replyTo !== undefined) data.replyTo = replyTo
    if (isActive !== undefined) data.isActive = isActive
    if (dailyLimit !== undefined) data.dailyLimit = dailyLimit ? parseInt(String(dailyLimit)) : null
    if (monthlyLimit !== undefined) data.monthlyLimit = monthlyLimit ? parseInt(String(monthlyLimit)) : null
    if (config !== undefined) data.config = config
    if (keyChanged) data.apiKey = sealApiKey(apiKey)

    // The webhook lives on the account the key belongs to (and, for Mailgun, on
    // the domain the From address picks), so any of these moves it.
    const nextType = type ?? before.type
    const reconnect =
      keyChanged ||
      nextType !== before.type ||
      (region !== undefined && (region || null) !== before.region) ||
      (nextType === 'mailgun' && fromEmail !== undefined && fromEmail !== before.fromEmail)

    if (reconnect) {
      // Remove the old webhook with the old key while it still applies.
      await disconnectProviderWebhook(before)
      Object.assign(data, { webhookId: null, webhookSecret: null, webhookStatus: null, webhookError: null, domain: null })
    }

    // If setting as default, unset the workspace's other defaults first
    if (isDefault) {
      await prisma.emailProvider.updateMany({
        where: { workspaceId: access.workspace.id, isDefault: true, id: { not: params.id } },
        data: { isDefault: false }
      })
      data.isDefault = true
    } else if (isDefault === false) {
      data.isDefault = false
    }

    let provider = await prisma.emailProvider.update({
      where: { id: params.id },
      data
    })

    if (reconnect) provider = (await connectProviderWebhook(provider.id)) ?? provider

    return NextResponse.json({ provider: presentProvider(provider) })
  } catch (error: any) {
    console.error('Error updating provider:', error)
    return NextResponse.json({ error: 'Failed to update provider' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const access = await authorize(params.id, true)
    if ('error' in access) {
      return NextResponse.json({ error: access.error }, { status: access.status })
    }

    // Take BorsFlow's webhook off the client's account too, so their provider
    // stops calling an address that no longer exists.
    const provider = await prisma.emailProvider.findUnique({ where: { id: params.id } })
    if (provider) await disconnectProviderWebhook(provider)

    await prisma.emailProvider.delete({
      where: { id: params.id }
    })
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete provider' }, { status: 500 })
  }
}
