import { OAuthService, OAuthTokens } from './oauth-base';
import axios from 'axios';

export class CalComOAuthService extends OAuthService {
  protected readonly platform = 'calcom';
  protected readonly clientId = process.env.CALCOM_CLIENT_ID || '';
  protected readonly clientSecret = process.env.CALCOM_CLIENT_SECRET || '';
  protected readonly redirectUri = `${process.env.NEXTAUTH_URL}/api/scheduling/oauth/calcom/callback`;
  protected readonly authUrl = 'https://app.cal.com/oauth/authorize';
  protected readonly tokenUrl = 'https://app.cal.com/oauth/token';

  /**
   * Generates Cal.com authorization URL
   */
  getAuthUrl(workspaceId: string, state?: string): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      response_type: 'code',
      state: state || JSON.stringify({ workspaceId })
    });
    
    return `${this.authUrl}?${params.toString()}`;
  }

  /**
   * Exchanges Cal.com auth code for tokens
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
   * Refreshes Cal.com access token
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
      refreshToken: data.refresh_token || refreshToken,
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
      scope: data.scope
    };
  }

  /**
   * Gets user profile from Cal.com
   */
  async getUserProfile(accessToken: string): Promise<{
    providerUserId: string;
    providerEmail: string;
    name?: string;
  }> {
    const response = await axios.get('https://api.cal.com/v1/me', {
      params: { apiKey: accessToken } // Cal.com sometimes uses API keys, but with OAuth also headers
    });
    
    // Adjusting for OAuth bearer
    const profileResponse = await axios.get('https://api.cal.com/v1/me', {
       headers: { Authorization: `Bearer ${accessToken}` }
    });
    
    const data = profileResponse.data.user;
    
    return {
      providerUserId: String(data.id),
      providerEmail: data.email,
      name: data.name || data.username
    };
  }
}
