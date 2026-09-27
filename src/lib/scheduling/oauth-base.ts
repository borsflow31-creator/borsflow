import { encrypt, decrypt } from '../encryption';
import { prisma } from '../prisma';

export interface OAuthTokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
  scope?: string;
}

export abstract class OAuthService {
  protected abstract readonly platform: string;
  protected abstract readonly clientId: string;
  protected abstract readonly clientSecret: string;
  protected abstract readonly redirectUri: string;
  protected abstract readonly authUrl: string;
  protected abstract readonly tokenUrl: string;
  
  /**
   * Generates the authorization URL for the provider
   * @param workspaceId The ID of the workspace
   * @param state Optional state for OAuth security
   * @returns The full authorization URL
   */
  abstract getAuthUrl(workspaceId: string, state?: string): string;

  /**
   * Exchanges an authorization code for access and refresh tokens
   * @param code The authorization code from the provider
   * @returns The generated OAuth tokens
   */
  abstract exchangeCode(code: string): Promise<OAuthTokens>;

  /**
   * Refreshes an expired access token using a refresh token
   * @param refreshToken The refresh token to use
   * @returns The refreshed OAuth tokens
   */
  abstract refreshAccessToken(refreshToken: string): Promise<OAuthTokens>;

  /**
   * Fetches the profile info from the provider (e.g., user ID, email)
   * @param accessToken The current access token
   * @returns The provider user profile details
   */
  abstract getUserProfile(accessToken: string): Promise<{
    providerUserId: string;
    providerEmail: string;
    name?: string;
  }>;

  /**
   * Stores credentials in the database for a calendar integration
   * @param workspaceId The ID of the workspace
   * @param type The provider type
   * @param tokens The tokens to store
   * @param profile The profile details from provider
   * @param createdBy The ID of the user creating the integration
   */
  async storeCalendarIntegration(
    workspaceId: string,
    type: string,
    tokens: OAuthTokens,
    profile: { providerUserId: string; providerEmail: string; name?: string },
    createdBy: string
  ) {
    const encryptedAccessToken = encrypt(tokens.accessToken);
    const encryptedRefreshToken = tokens.refreshToken ? encrypt(tokens.refreshToken) : undefined;
    
    return await prisma.calendarIntegration.upsert({
      where: {
        workspaceId_type_providerUserId: {
          workspaceId,
          type,
          providerUserId: profile.providerUserId
        }
      },
      update: {
        accessToken: encryptedAccessToken,
        refreshToken: encryptedRefreshToken,
        tokenExpiresAt: tokens.expiresAt,
        scope: tokens.scope,
        providerEmail: profile.providerEmail,
        name: profile.name || `${type === 'google_calendar' ? 'Google' : type === 'calcom' ? 'Cal.com' : 'Outlook'} Calendar`,
        isActive: true,
        updatedBy: createdBy
      },
      create: {
        workspaceId,
        type,
        providerUserId: profile.providerUserId,
        providerEmail: profile.providerEmail,
        name: profile.name || `${type === 'google_calendar' ? 'Google' : type === 'calcom' ? 'Cal.com' : 'Outlook'} Calendar`,
        accessToken: encryptedAccessToken,
        refreshToken: encryptedRefreshToken,
        tokenExpiresAt: tokens.expiresAt,
        scope: tokens.scope,
        isActive: true,
        createdById: createdBy
      }
    });
  }

  /**
   * Stores credentials for a video conferencing platform
   */
  async storeVideoConferenceConfig(
    workspaceId: string,
    platform: string,
    tokens: OAuthTokens,
    profile: { providerUserId: string; providerEmail: string },
    createdBy: string
  ) {
    const encryptedAccessToken = encrypt(tokens.accessToken);
    const encryptedRefreshToken = tokens.refreshToken ? encrypt(tokens.refreshToken) : undefined;
    
    return await prisma.videoConferenceConfig.upsert({
      where: {
        workspaceId_platform: {
          workspaceId,
          platform
        }
      },
      update: {
        accessToken: encryptedAccessToken,
        refreshToken: encryptedRefreshToken,
        tokenExpiresAt: tokens.expiresAt,
        providerUserId: profile.providerUserId,
        providerEmail: profile.providerEmail,
        isActive: true,
        updatedBy: createdBy
      },
      create: {
        workspaceId,
        platform,
        name: platform === 'zoom' ? 'Zoom' : platform === 'google_meet' ? 'Google Meet' : 'Microsoft Teams',
        providerUserId: profile.providerUserId,
        providerEmail: profile.providerEmail,
        accessToken: encryptedAccessToken,
        refreshToken: encryptedRefreshToken,
        tokenExpiresAt: tokens.expiresAt,
        isActive: true,
        createdById: createdBy
      }
    });
  }

  /**
   * Retrieves and decrypts the access token for an integration
   * @param integrationId The ID of the integration
   * @returns The decrypted access token and refresh token details
   */
  async getTokens(integrationId: string, model: 'calendarIntegration' | 'videoConferenceConfig'): Promise<OAuthTokens> {
    const data = await (prisma as any)[model].findUnique({
      where: { id: integrationId }
    });
    
    if (!data) throw new Error(`${model} not found`);
    
    let accessToken = decrypt(data.accessToken);
    let refreshToken = data.refreshToken ? decrypt(data.refreshToken) : undefined;
    
    // Check if token is expired
    if (data.tokenExpiresAt && new Date(data.tokenExpiresAt) <= new Date()) {
      if (!refreshToken) throw new Error('Refresh token missing for expired access token');
      
      const refreshedTokens = await this.refreshAccessToken(refreshToken);
      accessToken = refreshedTokens.accessToken;
      refreshToken = refreshedTokens.refreshToken || refreshToken;
      
      // Update tokens in DB
      await (prisma as any)[model].update({
        where: { id: integrationId },
        data: {
          accessToken: encrypt(accessToken),
          refreshToken: refreshedTokens.refreshToken ? encrypt(refreshedTokens.refreshToken) : undefined,
          tokenExpiresAt: refreshedTokens.expiresAt
        }
      });
    }
    
    return {
      accessToken,
      refreshToken,
      expiresAt: data.tokenExpiresAt,
      scope: data.scope
    };
  }
}
