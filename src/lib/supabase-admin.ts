import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * Server-only Supabase client using the service-role key. Used for Storage
 * uploads; never import this from a client component.
 *
 * Returns null when the env vars are missing so callers can respond with a
 * clear error instead of crashing at import time.
 */
let client: SupabaseClient | null = null

export function getSupabaseAdmin(): SupabaseClient | null {
  if (client) return client
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
  return client
}

export const CHAT_BUCKET = process.env.SUPABASE_CHAT_BUCKET || 'chat-uploads'
