import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { GoogleOAuthService } from './google-service';
import { ZoomOAuthService } from './zoom-service';
import { CalComOAuthService } from './calcom-service';
import { OAuthService } from './oauth-base';
import { checkWorkspacePermission } from '@/lib/workspace';

export async function handleOAuthCallback(
  platform: 'google' | 'zoom' | 'calcom',
  request: NextRequest
) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    // Redirect to login instead of returning JSON — OAuth callback must always redirect
    return NextResponse.redirect(new URL('/login?error=session_expired', request.url));
  }

  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const stateStr = searchParams.get('state');
  
  if (!code) {
    return NextResponse.json({ error: 'Authorization code missing' }, { status: 400 });
  }

  let state: { workspaceId: string } | null = null;
  try {
    state = stateStr ? JSON.parse(stateStr) : null;
  } catch (e) {
    console.error('State parse error:', e);
  }

  if (!state?.workspaceId) {
    return NextResponse.json({ error: 'Workspace contexts missing' }, { status: 400 });
  }

  // `state` comes back from the provider unauthenticated, so the workspace it
  // names must be one this user can change. Otherwise anyone could attach their
  // own calendar or Zoom account to another workspace by editing the state.
  const canConnect = await checkWorkspacePermission(state.workspaceId, session.user.id, 'content:create');
  if (!canConnect) {
    return NextResponse.redirect(new URL('/meetings?error=forbidden', request.url));
  }

  let service: OAuthService;
  switch (platform) {
    case 'google':
      service = new GoogleOAuthService();
      break;
    case 'zoom':
      service = new ZoomOAuthService();
      break;
    case 'calcom':
      service = new CalComOAuthService();
      break;
    default:
      return NextResponse.json({ error: 'Unsupported platform' }, { status: 400 });
  }

  try {
    // Exchange code for tokens
    const tokens = await service.exchangeCode(code);
    
    // Get user profile
    const profile = await service.getUserProfile(tokens.accessToken);
    
    // Store in DB
    if (platform === 'google' || platform === 'calcom') {
      const integration = await (service as any).storeCalendarIntegration(
        state.workspaceId,
        platform === 'google' ? 'google_calendar' : 'calcom',
        tokens,
        profile,
        session.user.id
      );
      // Create the booking webhook on the client's Cal.com account right away.
      // A failure is stored and shown on the card; hourly sync covers the gap.
      if (platform === 'calcom' && integration?.id) {
        const { connectCalcomWebhook } = await import('@/lib/email/webhook-setup');
        await connectCalcomWebhook(integration.id);
      }
    } else {
      await (service as any).storeVideoConferenceConfig(
        state.workspaceId,
        platform,
        tokens,
        profile,
        session.user.id
      );
    }

    // Every platform returns to the meetings page, which hosts the integrations
    // panel and shows the success/error toast. Google and Zoom used to go to
    // /workspaces/[id]/settings, a page that does not exist, so a successful
    // connection ended on a 404.
    const workspaceParam = encodeURIComponent(state.workspaceId);
    return NextResponse.redirect(new URL(`/meetings?workspace=${workspaceParam}&success=${platform}`, request.url));
  } catch (error: any) {
    console.error(`OAuth ${platform} callback error:`, error.response?.data || error.message);
    const workspaceParam = encodeURIComponent(state.workspaceId);
    return NextResponse.redirect(new URL(`/meetings?workspace=${workspaceParam}&error=${platform}`, request.url));
  }
}
