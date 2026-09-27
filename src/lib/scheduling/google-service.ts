import { OAuthService, OAuthTokens } from './oauth-base';
import axios from 'axios';

export class GoogleOAuthService extends OAuthService {
  protected readonly platform = 'google_calendar';
  protected readonly clientId = process.env.GOOGLE_CLIENT_ID || '';
  protected readonly clientSecret = process.env.GOOGLE_CLIENT_SECRET || '';
  protected readonly redirectUri = `${process.env.NEXTAUTH_URL}/api/scheduling/oauth/google/callback`;
  protected readonly authUrl = 'https://accounts.google.com/o/oauth2/v2/auth';
  protected readonly tokenUrl = 'https://oauth2.googleapis.com/token';

  /**
   * Generates Google authorization URL with necessary scopes
   */
  getAuthUrl(workspaceId: string, state?: string): string {
    const scopes = [
      'https://www.googleapis.com/auth/calendar.events',
      'https://www.googleapis.com/auth/calendar.readonly',
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile'
    ];
    
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      response_type: 'code',
      scope: scopes.join(' '),
      access_type: 'offline',
      prompt: 'consent',
      state: state || JSON.stringify({ workspaceId })
    });
    
    return `${this.authUrl}?${params.toString()}`;
  }

  /**
   * Exchanges Google auth code for tokens
   */
  async exchangeCode(code: string): Promise<OAuthTokens> {
    const response = await axios.post(this.tokenUrl, new URLSearchParams({
      code,
      client_id: this.clientId,
      client_secret: this.clientSecret,
      redirect_uri: this.redirectUri,
      grant_type: 'authorization_code'
    }));
    
    const data = response.data;
    
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
      scope: data.scope
    };
  }

  /**
   * Refreshes Google access token
   */
  async refreshAccessToken(refreshToken: string): Promise<OAuthTokens> {
    const response = await axios.post(this.tokenUrl, new URLSearchParams({
      refresh_token: refreshToken,
      client_id: this.clientId,
      client_secret: this.clientSecret,
      grant_type: 'refresh_token'
    }));
    
    const data = response.data;
    
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token || refreshToken, // Refresh tokens don't always change
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
      scope: data.scope
    };
  }

  /**
   * Gets user profile from Google
   */
  async getUserProfile(accessToken: string): Promise<{
    providerUserId: string;
    providerEmail: string;
    name?: string;
  }> {
    const response = await axios.get('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    
    const data = response.data;
    
    return {
      providerUserId: data.sub,
      providerEmail: data.email,
      name: data.name
    };
  }
}
