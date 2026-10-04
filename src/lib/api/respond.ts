import { NextResponse } from 'next/server'
import { ServiceError } from '@/lib/services/errors'

/**
 * Turn whatever a route's `try` caught into the response: a ServiceError is a
 * rejection the caller should show as-is (with its own status), anything else is
 * an unexpected failure that is logged and answered with a generic 500.
 */
export function failure(error: unknown, fallback: string, context: string): NextResponse {
  if (error instanceof ServiceError) {
    return NextResponse.json({ error: error.message }, { status: error.status })
  }
  console.error(`${context}:`, error)
  return NextResponse.json({ error: fallback }, { status: 500 })
}

/** Read a JSON object body, or null when it is missing or not an object. */
export async function readBody(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const body = await request.json()
    return body && typeof body === 'object' && !Array.isArray(body) ? (body as Record<string, unknown>) : null
  } catch {
    return null
  }
}

export const INVALID_BODY = () => NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
