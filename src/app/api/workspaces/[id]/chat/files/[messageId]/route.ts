import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSupabaseAdmin, CHAT_BUCKET } from '@/lib/supabase-admin'
import { findVisibleChannel, getChatAccess } from '@/lib/chat/server'

// Long enough for a slow download, short enough that a copied link soon dies.
const SIGNED_URL_TTL_SECONDS = 5 * 60

// GET /api/workspaces/[id]/chat/files/[messageId]
// Attachments live in a private bucket. Members who can see the message's
// channel are redirected to a short-lived signed URL; everyone else gets 404.
export async function GET(_req: Request, { params }: { params: { id: string; messageId: string } }) {
  const result = await getChatAccess(params.id)
  if ('error' in result) return result.error
  const { access } = result

  const message = await prisma.message.findFirst({
    where: { id: params.messageId, workspaceId: params.id, deletedAt: null, filePath: { not: null } },
    select: { channelId: true, filePath: true, fileName: true },
  })
  if (!message?.channelId || !message.filePath || !(await findVisibleChannel(access, message.channelId))) {
    return NextResponse.json({ error: 'File not found' }, { status: 404 })
  }

  const supabase = getSupabaseAdmin()
  if (!supabase) return NextResponse.json({ error: 'File storage is not configured' }, { status: 500 })

  const { data, error } = await supabase.storage
    .from(CHAT_BUCKET)
    .createSignedUrl(message.filePath, SIGNED_URL_TTL_SECONDS, {
      download: message.fileName ?? undefined,
    })
  if (error || !data?.signedUrl) {
    console.error('[chat/files] signed URL failed:', error?.message)
    return NextResponse.json({ error: 'File unavailable' }, { status: 502 })
  }

  return NextResponse.redirect(data.signedUrl, { headers: { 'Cache-Control': 'private, no-store' } })
}
