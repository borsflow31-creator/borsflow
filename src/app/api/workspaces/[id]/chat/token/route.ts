import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getAblyRest } from '@/lib/ably'
import { CHAT_CAPABILITY_OPERATIONS, workspaceCapabilityKey } from '@/lib/chatRooms'

export const dynamic = 'force-dynamic'

// Short-lived so a member removed from the workspace loses realtime access quickly.
// (Instant revocation would need Ably token revocation, a paid feature.)
const TOKEN_TTL_MS = 30 * 60 * 1000

const NO_STORE = { 'Cache-Control': 'no-store' }

async function getMember(workspaceId: string, userId: string) {
  return prisma.workspace.findFirst({
    where: {
      id: workspaceId,
      OR: [{ ownerId: userId }, { members: { some: { userId } } }],
    },
    select: { id: true },
  })
}

// GET /api/workspaces/[id]/chat/token
// Issues an Ably TokenRequest scoped to this workspace's chat rooms only.
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE })
  }

  const member = await getMember(params.id, session.user.id)
  if (!member) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403, headers: NO_STORE })
  }

  try {
    const tokenRequest = await getAblyRest().auth.createTokenRequest({
      clientId: session.user.id,
      ttl: TOKEN_TTL_MS,
      capability: { [workspaceCapabilityKey(params.id)]: [...CHAT_CAPABILITY_OPERATIONS] },
    })
    return NextResponse.json(tokenRequest, { headers: NO_STORE })
  } catch (err) {
    console.error('Ably token request failed:', err)
    return NextResponse.json({ error: 'Realtime chat is unavailable' }, { status: 503, headers: NO_STORE })
  }
}
