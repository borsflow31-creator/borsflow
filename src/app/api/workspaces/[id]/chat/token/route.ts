import { NextResponse } from 'next/server'
import { SignJWT } from 'jose'
import { getChatAccess } from '@/lib/chat/server'

export const dynamic = 'force-dynamic'

// Supabase Realtime checks the RLS policies on realtime.messages each time a
// client joins a topic, so access follows live workspace and channel membership.
// The token only proves who the user is; the client refreshes it before expiry.
const TOKEN_TTL_S = 30 * 60

const NO_STORE = { 'Cache-Control': 'no-store' }

// GET /api/workspaces/[id]/chat/token
// Issues a short-lived Supabase JWT (sub = our user id) for private Realtime
// channels. Sign-in is next-auth, so we sign it with the project's JWT secret.
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const result = await getChatAccess(params.id)
  if ('error' in result) {
    result.error.headers.set('Cache-Control', 'no-store')
    return result.error
  }
  const { access } = result

  const secret = process.env.SUPABASE_JWT_SECRET
  if (!secret) {
    console.error('Realtime token request failed: SUPABASE_JWT_SECRET is not set')
    return NextResponse.json({ error: 'Realtime chat is unavailable' }, { status: 503, headers: NO_STORE })
  }

  const now = Math.floor(Date.now() / 1000)
  const expiresAt = now + TOKEN_TTL_S
  const token = await new SignJWT({ role: 'authenticated' })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject(access.userId)
    .setAudience('authenticated')
    .setIssuedAt(now)
    .setExpirationTime(expiresAt)
    .sign(new TextEncoder().encode(secret))

  return NextResponse.json({ token, expiresAt: expiresAt * 1000 }, { headers: NO_STORE })
}
