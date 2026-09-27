import { OAuthService, OAuthTokens } from './oauth-base';
import axios from 'axios';

export class ZoomOAuthService extends OAuthService {
  protected readonly platform = 'zoom';
  protected readonly clientId = process.env.ZOOM_CLIENT_ID || '';
  protected readonly clientSecret = process.env.ZOOM_CLIENT_SECRET || '';
  protected readonly redirectUri = `${process.env.NEXTAUTH_URL}/api/scheduling/oauth/zoom/callback`;
  protected readonly authUrl = 'https://zoom.us/oauth/authorize';
  protected readonly tokenUrl = 'https://zoom.us/oauth/token';

  /**
   * Generates Zoom authorization URL
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
   * Exchanges Zoom auth code for tokens
   */
  async exchangeCode(code: string): Promise<OAuthTokens> {
    const authHeader = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');
    const response = await axios.post(this.tokenUrl, new URLSearchParams({
      code,
      redirect_uri: this.redirectUri,
      grant_type: 'authorization_code'
    }), {
      headers: { Authorization: `Basic ${authHeader}` }
    });
    
    const data = response.data;
    
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
      scope: data.scope
    };
  }

  /**
   * Refreshes Zoom access token
   */
  async refreshAccessToken(refreshToken: string): Promise<OAuthTokens> {
    const authHeader = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');
    const response = await axios.post(this.tokenUrl, new URLSearchParams({
      refresh_token: refreshToken,
      grant_type: 'refresh_token'
    }), {
      headers: { Authorization: `Basic ${authHeader}` }
    });
    
    const data = response.data;
    
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token || refreshToken,
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
      scope: data.scope
    };
  }

  /**
   * Gets user profile from Zoom
   */
  async getUserProfile(accessToken: string): Promise<{
    providerUserId: string;
    providerEmail: string;
    name?: string;
  }> {
    const response = await axios.get('https://api.zoom.us/v2/users/me', {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    
    const data = response.data;
    
    return {
      providerUserId: data.id,
      providerEmail: data.email,
      name: `${data.first_name} ${data.last_name}`
    };
  }
}
