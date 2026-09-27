import { NextRequest } from 'next/server';
import { handleOAuthCallback } from '@/lib/scheduling/oauth-callback-handler';

export async function GET(request: NextRequest) {
  return handleOAuthCallback('zoom', request);
}
