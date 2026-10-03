import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSupabaseAdmin, CHAT_BUCKET } from '@/lib/supabase-admin'
import {
  MAX_CHANNEL_DESCRIPTION,
  findVisibleChannel,
  getChatAccess,
  logRealtimeError,
  publishSignal,
  readJson,
  slugifyChannelName,
} from '@/lib/chat/server'

type Params = { params: { id: string; channelId: string } }

// DELETE /api/workspaces/[id]/chat/channels/[channelId]
// The channel's creator, the owner or an admin can delete it. Its messages,
// replies, reactions and read markers go with it (database cascade), and its
// attachments are removed from storage.
export async function DELETE(_req: Request, { params }: Params) {
  const result = await getChatAccess(params.id, { write: true })
  if ('error' in result) return result.error
  const { access } = result

  const channel = await findVisibleChannel(access, params.channelId)
  if (!channel) return NextResponse.json({ error: 'Channel not found' }, { status: 404 })
  if (channel.createdById !== access.userId && !access.canModerate) {
    return NextResponse.json({ error: 'Only the channel creator or a workspace admin can delete it' }, { status: 403 })
  }

  const files = await prisma.message.findMany({
    where: { channelId: channel.id, filePath: { not: null } },
    select: { filePath: true },
  })

  await prisma.channel.delete({ where: { id: channel.id } })

  const paths = files.map(f => f.filePath!).filter(Boolean)
  if (paths.length > 0) {
    await getSupabaseAdmin()?.storage.from(CHAT_BUCKET).remove(paths).catch(logRealtimeError('remove attachments'))
  }

  await publishSignal(params.id, { type: 'channels-changed' }).catch(logRealtimeError('signal'))

  return NextResponse.json({ success: true })
}

// PATCH /api/workspaces/[id]/chat/channels/[channelId]  { name?, description? }
export async function PATCH(req: Request, { params }: Params) {
  const result = await getChatAccess(params.id, { write: true })
  if ('error' in result) return result.error
  const { access } = result

  const channel = await findVisibleChannel(access, params.channelId)
  if (!channel) return NextResponse.json({ error: 'Channel not found' }, { status: 404 })
  if (channel.createdById !== access.userId && !access.canModerate) {
    return NextResponse.json({ error: 'Only the channel creator or a workspace admin can edit it' }, { status: 403 })
  }

  const body = await readJson(req)
  if (!body) return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })

  const data: { name?: string; description?: string | null } = {}
  if (body.name !== undefined) {
    const slug = typeof body.name === 'string' ? slugifyChannelName(body.name) : ''
    if (!slug) return NextResponse.json({ error: 'Use letters or numbers in the channel name' }, { status: 400 })
    if (slug !== channel.name) {
      const taken = await prisma.channel.findFirst({
        where: { workspaceId: params.id, name: slug, id: { not: channel.id } },
        select: { id: true },
      })
      if (taken) return NextResponse.json({ error: 'A channel with that name already exists' }, { status: 409 })
    }
    data.name = slug
  }
  if (body.description !== undefined) {
    data.description = typeof body.description === 'string' && body.description.trim()
      ? body.description.trim().slice(0, MAX_CHANNEL_DESCRIPTION)
      : null
  }

  const updated = await prisma.channel.update({ where: { id: channel.id }, data })
  await publishSignal(params.id, { type: 'channels-changed' }).catch(logRealtimeError('signal'))

  return NextResponse.json({ channel: updated })
}
