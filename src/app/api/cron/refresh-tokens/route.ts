import { NextRequest, NextResponse } from 'next/server';
import { isAuthorizedCron } from '@/lib/api/cron';
import { prisma } from '@/lib/prisma';
import { GoogleOAuthService } from '@/lib/scheduling/google-service';
import { ZoomOAuthService } from '@/lib/scheduling/zoom-service';
import { CalComOAuthService } from '@/lib/scheduling/calcom-service';
import { encrypt, decrypt } from '@/lib/encryption';

/**
 * A Next.js API route that handles token refreshing across all providers
 * Intended to be run periodically (e.g., every 30 minutes)
 */
export async function GET(request: NextRequest) {
  // Check for cron token security if needed
  // Shared cron check: requires CRON_SECRET (Bearer or x-cron-secret) and refuses
  // every call when the secret is unset. This route used to skip the check
  // entirely in that case, leaving it open to anyone.
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const thresholdDate = new Date();
  thresholdDate.setMinutes(thresholdDate.getMinutes() + 45); // Refresh tokens that expire within 45 mins

  try {
    // 1. Refresh calendar integrations (Google, Cal.com)
    const calendarIntegrations = await prisma.calendarIntegration.findMany({
      where: {
        isActive: true,
        refreshToken: { not: null },
        tokenExpiresAt: { lte: thresholdDate },
      }
    });

    const googleService = new GoogleOAuthService();
    const calcomService = new CalComOAuthService();
    let count = 0;

    for (const integration of calendarIntegrations) {
      const service = integration.type === 'google_calendar' ? googleService : calcomService;
      const decryptedRefreshToken = decrypt(integration.refreshToken!);
      
      try {
        const newTokens = await service.refreshAccessToken(decryptedRefreshToken);
        await prisma.calendarIntegration.update({
          where: { id: integration.id },
          data: {
            accessToken: encrypt(newTokens.accessToken),
            refreshToken: newTokens.refreshToken ? encrypt(newTokens.refreshToken) : undefined,
            tokenExpiresAt: newTokens.expiresAt,
            syncStatus: 'active'
          }
        });
        count++;
      } catch (err: any) {
        console.error(`Token refresh failed for integration ${integration.id}:`, err.message);
        await prisma.calendarIntegration.update({
          where: { id: integration.id },
          data: {
            syncStatus: 'error',
            lastSyncError: 'Token refresh failed'
          }
        });
      }
    }

    // 2. Refresh video configurations (Zoom)
    const videoConfigs = await prisma.videoConferenceConfig.findMany({
      where: {
        isActive: true,
        refreshToken: { not: null },
        tokenExpiresAt: { lte: thresholdDate },
      }
    });

    const zoomService = new ZoomOAuthService();
    for (const config of videoConfigs) {
      if (config.platform === 'zoom') {
        const decryptedRefreshToken = decrypt(config.refreshToken!);
        try {
          const newTokens = await zoomService.refreshAccessToken(decryptedRefreshToken);
          await prisma.videoConferenceConfig.update({
            where: { id: config.id },
            data: {
              accessToken: encrypt(newTokens.accessToken),
              refreshToken: newTokens.refreshToken ? encrypt(newTokens.refreshToken) : undefined,
              tokenExpiresAt: newTokens.expiresAt,
            }
          });
          count++;
        } catch (err: any) {
          console.error(`Token refresh failed for video config ${config.id}:`, err.message);
        }
      }
    }

    return NextResponse.json({ message: `Successfully refreshed ${count} tokens`, refreshed: count });
  } catch (error: any) {
    console.error('CRON: Global token refresh failure:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
