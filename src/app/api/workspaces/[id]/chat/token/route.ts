import { NextResponse } from 'next/server'
import type Ably from 'ably'
import { getAblyRest } from '@/lib/ably'
import { CHAT_CAPABILITY_OPERATIONS, chatRoomChannel, chatSignalChannel } from '@/lib/chatRooms'
import { getChatAccess, visibleChannelIds } from '@/lib/chat/server'

export const dynamic = 'force-dynamic'

// Short-lived so a member removed from the workspace (or a private channel)
// loses realtime access quickly. The client re-requests a token whenever its
// channel list changes, so new channels are covered without waiting for expiry.
// (Instant revocation would need Ably token revocation, a paid feature.)
const TOKEN_TTL_MS = 30 * 60 * 1000

const NO_STORE = { 'Cache-Control': 'no-store' }

// GET /api/workspaces/[id]/chat/token
// Issues an Ably TokenRequest covering only the rooms of channels this user can
// see (so private channels stay private in realtime too), plus subscribe-only
// access to the workspace signal channel.
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const result = await getChatAccess(params.id)
  if ('error' in result) {
    result.error.headers.set('Cache-Control', 'no-store')
    return result.error
  }
  const { access } = result

  const capability: Record<string, Ably.capabilityOp[]> = {
    [chatSignalChannel(params.id)]: ['subscribe'],
  }
  // Viewers can watch and appear in presence but not type into the room.
  const roomOps: Ably.capabilityOp[] = access.canWrite
    ? [...CHAT_CAPABILITY_OPERATIONS]
    : CHAT_CAPABILITY_OPERATIONS.filter(op => op !== 'publish')
  for (const channelId of await visibleChannelIds(access)) {
    capability[chatRoomChannel(params.id, channelId)] = roomOps
  }

  try {
    const tokenRequest = await getAblyRest().auth.createTokenRequest({
      clientId: access.userId,
      ttl: TOKEN_TTL_MS,
      capability,
    })
    return NextResponse.json(tokenRequest, { headers: NO_STORE })
  } catch (err) {
    console.error('Ably token request failed:', err)
    return NextResponse.json({ error: 'Realtime chat is unavailable' }, { status: 503, headers: NO_STORE })
  }
}
