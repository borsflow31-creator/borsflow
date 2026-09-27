# Scheduling Integration Module - OAuth 2.0 Authentication Flow Design

## Overview
This document details the OAuth 2.0 authentication flows required for integrating with Cal.com, Zoom, and Google Meet. The design ensures secure token management, proper scope handling, and seamless user experience.

## Authentication Architecture

### Components
1. **OAuth Client Service**: Manages OAuth flows for all providers
2. **Token Store Service**: Secure storage and retrieval of OAuth tokens
3. **Token Refresh Service**: Automatic token refresh before expiration
4. **Encryption Service**: Encrypts/decrypts sensitive token data
5. **Webhook Handler**: Processes OAuth callbacks and token updates

## Provider-Specific OAuth Configurations

### 1. Cal.com OAuth 2.0

#### Application Registration
- **OAuth 2.0 Endpoint**: `https://app.cal.com/oauth/authorize`
- **Token Endpoint**: `https://app.cal.com/oauth/token`
- **Scopes Required**:
  - `calendars:read` - Read calendar events
  - `calendars:write` - Create and update calendar events
  - `bookings:read` - Read booking information
  - `bookings:write` - Create and update bookings

#### OAuth Flow
```typescript
// Authorization Request
GET https://app.cal.com/oauth/authorize?
  response_type=code&
  client_id={CLIENT_ID}&
  redirect_uri={REDIRECT_URI}&
  scope=calendars:read calendars:write bookings:read bookings:write&
  state={STATE_TOKEN}

// Token Exchange
POST https://app.cal.com/oauth/token
Content-Type: application/x-www-form-urlencoded

grant_type=authorization_code&
code={AUTHORIZATION_CODE}&
redirect_uri={REDIRECT_URI}&
client_id={CLIENT_ID}&
client_secret={CLIENT_SECRET}

// Token Refresh
POST https://app.cal.com/oauth/token
Content-Type: application/x-www-form-urlencoded

grant_type=refresh_token&
refresh_token={REFRESH_TOKEN}&
client_id={CLIENT_ID}&
client_secret={CLIENT_SECRET}
```

#### Token Response
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "Bearer",
  "expires_in": 3600,
  "scope": "calendars:read calendars:write bookings:read bookings:write"
}
```

### 2. Zoom OAuth 2.0

#### Application Registration
- **OAuth 2.0 Endpoint**: `https://zoom.us/oauth/authorize`
- **Token Endpoint**: `https://zoom.us/oauth/token`
- **Scopes Required**:
  - `meeting:write` - Create and manage meetings
  - `meeting:read` - Read meeting information
  - `user:read` - Read user information
  - `user_info:read` - Read user profile

#### OAuth Flow
```typescript
// Authorization Request
GET https://zoom.us/oauth/authorize?
  response_type=code&
  client_id={CLIENT_ID}&
  redirect_uri={REDIRECT_URI}&
  scope=meeting:write meeting:read user:read user_info:read&
  state={STATE_TOKEN}

// Token Exchange
POST https://zoom.us/oauth/token
Content-Type: application/x-www-form-urlencoded

grant_type=authorization_code&
code={AUTHORIZATION_CODE}&
redirect_uri={REDIRECT_URI}&
client_id={CLIENT_ID}&
client_secret={CLIENT_SECRET}

// Token Refresh
POST https://zoom.us/oauth/token
Content-Type: application/x-www-form-urlencoded

grant_type=refresh_token&
refresh_token={REFRESH_TOKEN}&
client_id={CLIENT_ID}&
client_secret={CLIENT_SECRET}
```

#### Token Response
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "Bearer",
  "expires_in": 3600,
  "scope": "meeting:write meeting:read user:read user_info:read"
}
```

### 3. Google Meet OAuth 2.0

#### Application Registration
- **OAuth 2.0 Endpoint**: `https://accounts.google.com/o/oauth2/v2/auth`
- **Token Endpoint**: `https://oauth2.googleapis.com/token`
- **Scopes Required**:
  - `https://www.googleapis.com/auth/calendar` - Full calendar access
  - `https://www.googleapis.com/auth/calendar.events` - Manage calendar events

#### OAuth Flow
```typescript
// Authorization Request
GET https://accounts.google.com/o/oauth2/v2/auth?
  response_type=code&
  client_id={CLIENT_ID}&
  redirect_uri={REDIRECT_URI}&
  scope=https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/calendar.events&
  state={STATE_TOKEN}&
  access_type=offline&
  prompt=consent

// Token Exchange
POST https://oauth2.googleapis.com/token
Content-Type: application/x-www-form-urlencoded

grant_type=authorization_code&
code={AUTHORIZATION_CODE}&
redirect_uri={REDIRECT_URI}&
client_id={CLIENT_ID}&
client_secret={CLIENT_SECRET}

// Token Refresh
POST https://oauth2.googleapis.com/token
Content-Type: application/x-www-form-urlencoded

grant_type=refresh_token&
refresh_token={REFRESH_TOKEN}&
client_id={CLIENT_ID}&
client_secret={CLIENT_SECRET}
```

#### Token Response
```json
{
  "access_token": "ya29.a0AfH6SMBx...",
  "refresh_token": "1//0gX...",
  "token_type": "Bearer",
  "expires_in": 3599,
  "scope": "https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/calendar.events"
}
```

## Implementation Architecture

### 1. OAuth Service Layer

```typescript
// src/lib/oauth/oauth-service.ts
interface OAuthProvider {
  name: 'calcom' | 'zoom' | 'google';
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes: string[];
  authorizationUrl: string;
  tokenUrl: string;
  userInfoUrl?: string;
}

class OAuthService {
  private providers: Map<string, OAuthProvider>;
  
  constructor() {
    this.providers = new Map([
      ['calcom', {
        name: 'calcom',
        clientId: process.env.CALCOM_CLIENT_ID!,
        clientSecret: process.env.CALCOM_CLIENT_SECRET!,
        redirectUri: `${process.env.APP_URL}/api/oauth/callback/calcom`,
        scopes: ['calendars:read', 'calendars:write', 'bookings:read', 'bookings:write'],
        authorizationUrl: 'https://app.cal.com/oauth/authorize',
        tokenUrl: 'https://app.cal.com/oauth/token',
      }],
      ['zoom', {
        name: 'zoom',
        clientId: process.env.ZOOM_CLIENT_ID!,
        clientSecret: process.env.ZOOM_CLIENT_SECRET!,
        redirectUri: `${process.env.APP_URL}/api/oauth/callback/zoom`,
        scopes: ['meeting:write', 'meeting:read', 'user:read', 'user_info:read'],
        authorizationUrl: 'https://zoom.us/oauth/authorize',
        tokenUrl: 'https://zoom.us/oauth/token',
      }],
      ['google', {
        name: 'google',
        clientId: process.env.GOOGLE_CLIENT_ID!,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        redirectUri: `${process.env.APP_URL}/api/oauth/callback/google`,
        scopes: [
          'https://www.googleapis.com/auth/calendar',
          'https://www.googleapis.com/auth/calendar.events'
        ],
        authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
        tokenUrl: 'https://oauth2.googleapis.com/token',
      }],
    ]);
  }
  
  getAuthorizationUrl(provider: string, state: string): string {
    const config = this.providers.get(provider);
    if (!config) throw new Error(`Unknown provider: ${provider}`);
    
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      scope: config.scopes.join(' '),
      state,
    });
    
    // Google-specific parameters
    if (provider === 'google') {
      params.append('access_type', 'offline');
      params.append('prompt', 'consent');
    }
    
    return `${config.authorizationUrl}?${params.toString()}`;
  }
  
  async exchangeCodeForTokens(provider: string, code: string): Promise<OAuthTokens> {
    const config = this.providers.get(provider);
    if (!config) throw new Error(`Unknown provider: ${provider}`);
    
    const response = await fetch(config.tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: config.redirectUri,
        client_id: config.clientId,
        client_secret: config.clientSecret,
      }),
    });
    
    if (!response.ok) {
      throw new Error(`Token exchange failed: ${response.statusText}`);
    }
    
    const tokens = await response.json();
    return {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      tokenType: tokens.token_type,
      expiresIn: tokens.expires_in,
      scope: tokens.scope,
      expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
    };
  }
  
  async refreshAccessToken(provider: string, refreshToken: string): Promise<OAuthTokens> {
    const config = this.providers.get(provider);
    if (!config) throw new Error(`Unknown provider: ${provider}`);
    
    const response = await fetch(config.tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: config.clientId,
        client_secret: config.clientSecret,
      }),
    });
    
    if (!response.ok) {
      throw new Error(`Token refresh failed: ${response.statusText}`);
    }
    
    const tokens = await response.json();
    return {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token || refreshToken, // Some providers don't return new refresh token
      tokenType: tokens.token_type,
      expiresIn: tokens.expires_in,
      scope: tokens.scope,
      expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
    };
  }
}
```

### 2. Token Management Service

```typescript
// src/lib/oauth/token-manager.ts
interface OAuthTokens {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresIn: number;
  scope?: string;
  expiresAt: Date;
}

class TokenManager {
  private oauthService: OAuthService;
  private encryptionService: EncryptionService;
  
  constructor() {
    this.oauthService = new OAuthService();
    this.encryptionService = new EncryptionService();
  }
  
  async storeTokens(
    workspaceId: string,
    provider: string,
    tokens: OAuthTokens,
    providerUserId: string,
    providerEmail: string
  ): Promise<void> {
    const encryptedAccessToken = await this.encryptionService.encrypt(tokens.accessToken);
    const encryptedRefreshToken = await this.encryptionService.encrypt(tokens.refreshToken);
    
    await prisma.calendarIntegration.upsert({
      where: {
        workspaceId_type_providerUserId: {
          workspaceId,
          type: provider,
          providerUserId,
        },
      },
      create: {
        workspaceId,
        type: provider,
        name: `${provider.charAt(0).toUpperCase() + provider.slice(1)} Integration`,
        accessToken: encryptedAccessToken,
        refreshToken: encryptedRefreshToken,
        tokenExpiresAt: tokens.expiresAt,
        scope: tokens.scope,
        providerUserId,
        providerEmail,
        isActive: true,
        syncEnabled: true,
        createdBy: 'system', // Should be actual user ID
      },
      update: {
        accessToken: encryptedAccessToken,
        refreshToken: encryptedRefreshToken,
        tokenExpiresAt: tokens.expiresAt,
        scope: tokens.scope,
        isActive: true,
        syncStatus: 'active',
      },
    });
  }
  
  async getValidAccessToken(integrationId: string): Promise<string> {
    const integration = await prisma.calendarIntegration.findUnique({
      where: { id: integrationId },
    });
    
    if (!integration) {
      throw new Error('Integration not found');
    }
    
    // Check if token needs refresh (5 minutes buffer)
    if (integration.tokenExpiresAt && integration.tokenExpiresAt < new Date(Date.now() + 5 * 60 * 1000)) {
      return await this.refreshToken(integration);
    }
    
    return await this.encryptionService.decrypt(integration.accessToken!);
  }
  
  async refreshToken(integration: CalendarIntegration): Promise<string> {
    try {
      const decryptedRefreshToken = await this.encryptionService.decrypt(integration.refreshToken!);
      const tokens = await this.oauthService.refreshAccessToken(integration.type, decryptedRefreshToken);
      
      const encryptedAccessToken = await this.encryptionService.encrypt(tokens.accessToken);
      const encryptedRefreshToken = await this.encryptionService.encrypt(tokens.refreshToken);
      
      await prisma.calendarIntegration.update({
        where: { id: integration.id },
        data: {
          accessToken: encryptedAccessToken,
          refreshToken: encryptedRefreshToken,
          tokenExpiresAt: tokens.expiresAt,
          syncStatus: 'active',
          lastSyncError: null,
        },
      });
      
      return tokens.accessToken;
    } catch (error) {
      // Mark integration as failed
      await prisma.calendarIntegration.update({
        where: { id: integration.id },
        data: {
          syncStatus: 'error',
          lastSyncError: error.message,
          lastSyncErrorAt: new Date(),
        },
      });
      
      throw error;
    }
  }
  
  async revokeTokens(integrationId: string): Promise<void> {
    await prisma.calendarIntegration.update({
      where: { id: integrationId },
      data: {
        accessToken: null,
        refreshToken: null,
        isActive: false,
        syncStatus: 'disabled',
      },
    });
  }
}
```

### 3. Encryption Service

```typescript
// src/lib/oauth/encryption-service.ts
import crypto from 'crypto';

class EncryptionService {
  private algorithm = 'aes-256-gcm';
  private keyLength = 32;
  private ivLength = 16;
  private authTagLength = 16;
  
  constructor() {
    if (!process.env.ENCRYPTION_KEY) {
      throw new Error('ENCRYPTION_KEY environment variable is required');
    }
  }
  
  private getKey(): Buffer {
    const key = process.env.ENCRYPTION_KEY!;
    return crypto.scryptSync(key, 'salt', this.keyLength);
  }
  
  async encrypt(plaintext: string): Promise<string> {
    const iv = crypto.randomBytes(this.ivLength);
    const key = this.getKey();
    
    const cipher = crypto.createCipheriv(this.algorithm, key, iv);
    
    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    // Combine IV, auth tag, and encrypted data
    const combined = Buffer.concat([
      iv,
      authTag,
      Buffer.from(encrypted, 'hex'),
    ]);
    
    return combined.toString('base64');
  }
  
  async decrypt(ciphertext: string): Promise<string> {
    const combined = Buffer.from(ciphertext, 'base64');
    
    const iv = combined.slice(0, this.ivLength);
    const authTag = combined.slice(this.ivLength, this.ivLength + this.authTagLength);
    const encrypted = combined.slice(this.ivLength + this.authTagLength);
    
    const key = this.getKey();
    
    const decipher = crypto.createDecipheriv(this.algorithm, key, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encrypted, null, 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }
}
```

### 4. OAuth Callback Handler

```typescript
// src/app/api/oauth/callback/[provider]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { OAuthService } from '@/lib/oauth/oauth-service';
import { TokenManager } from '@/lib/oauth/token-manager';

export async function GET(
  request: NextRequest,
  { params }: { params: { provider: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const { provider } = params;
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');
    
    // Handle OAuth errors
    if (error) {
      return NextResponse.redirect(
        new URL(`/settings?oauth_error=${error}`, request.url)
      );
    }
    
    if (!code || !state) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      );
    }
    
    // Verify state (should match what we stored in session/cookie)
    // For simplicity, we'll skip state verification in this example
    
    // Exchange code for tokens
    const oauthService = new OAuthService();
    const tokenManager = new TokenManager();
    
    const tokens = await oauthService.exchangeCodeForTokens(provider, code);
    
    // Get user info from provider
    const userInfo = await oauthService.getUserInfo(provider, tokens.accessToken);
    
    // Store tokens in database
    // We need to determine which workspace to associate with
    // For now, we'll use the user's default workspace
    const workspace = await prisma.workspace.findFirst({
      where: {
        ownerId: session.user.id,
      },
    });
    
    if (!workspace) {
      return NextResponse.json(
        { error: 'No workspace found' },
        { status: 404 }
      );
    }
    
    await tokenManager.storeTokens(
      workspace.id,
      provider,
      tokens,
      userInfo.id,
      userInfo.email
    );
    
    // Redirect to settings page with success
    return NextResponse.redirect(
      new URL('/settings?oauth_success=true', request.url)
    );
  } catch (error) {
    console.error('OAuth callback error:', error);
    return NextResponse.redirect(
      new URL(`/settings?oauth_error=${encodeURIComponent(error.message)}`, request.url)
    );
  }
}
```

### 5. OAuth Initiation Endpoint

```typescript
// src/app/api/oauth/authorize/[provider]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { OAuthService } from '@/lib/oauth/oauth-service';
import crypto from 'crypto';

export async function POST(
  request: NextRequest,
  { params }: { params: { provider: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const { provider } = params;
    const body = await request.json();
    const { workspaceId } = body;
    
    // Verify workspace access
    const workspace = await prisma.workspace.findFirst({
      where: {
        id: workspaceId,
        OR: [
          { ownerId: session.user.id },
          { members: { some: { userId: session.user.id } } },
        ],
      },
    });
    
    if (!workspace) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }
    
    // Generate state token
    const state = crypto.randomBytes(32).toString('hex');
    
    // Store state in session or database for verification
    // For simplicity, we'll use a cookie
    const response = NextResponse.json({ success: true });
    response.cookies.set(`oauth_state_${provider}`, state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 600, // 10 minutes
    });
    
    // Get authorization URL
    const oauthService = new OAuthService();
    const authUrl = oauthService.getAuthorizationUrl(provider, state);
    
    return NextResponse.json({ authUrl });
  } catch (error) {
    console.error('OAuth authorization error:', error);
    return NextResponse.json(
      { error: 'Failed to initiate OAuth flow' },
      { status: 500 }
    );
  }
}
```

## Token Refresh Strategy

### Automatic Refresh
- **Background Job**: Cron job checks for expiring tokens every 15 minutes
- **On-Demand Refresh**: Refresh tokens when API calls fail with 401
- **Preemptive Refresh**: Refresh tokens 5 minutes before expiration

### Refresh Implementation
```typescript
// src/lib/oauth/token-refresh-job.ts
import cron from 'node-cron';

class TokenRefreshJob {
  private tokenManager: TokenManager;
  
  constructor() {
    this.tokenManager = new TokenManager();
  }
  
  start(): void {
    // Run every 15 minutes
    cron.schedule('*/15 * * * *', async () => {
      await this.refreshExpiringTokens();
    });
  }
  
  private async refreshExpiringTokens(): Promise<void> {
    const expiringIntegrations = await prisma.calendarIntegration.findMany({
      where: {
        isActive: true,
        syncEnabled: true,
        tokenExpiresAt: {
          lte: new Date(Date.now() + 15 * 60 * 1000), // 15 minutes from now
        },
      },
    });
    
    for (const integration of expiringIntegrations) {
      try {
        await this.tokenManager.refreshToken(integration);
      } catch (error) {
        console.error(`Failed to refresh token for integration ${integration.id}:`, error);
      }
    }
  }
}
```

## Security Best Practices

### 1. State Parameter
- Generate cryptographically secure random state tokens
- Store state securely (HTTP-only cookies or encrypted session)
- Verify state on callback to prevent CSRF attacks

### 2. PKCE (Proof Key for Code Exchange)
- Implement PKCE for mobile/native applications
- Generate code verifier and code challenge
- Include in authorization request

### 3. Token Storage
- Encrypt all tokens at rest
- Use separate encryption keys per environment
- Rotate encryption keys periodically

### 4. Token Validation
- Validate token signatures
- Check token expiration on every use
- Implement token revocation

### 5. Scope Management
- Request minimum required scopes
- Display requested scopes to users
- Allow users to revoke specific scopes

## Error Handling

### Common OAuth Errors
1. **invalid_grant**: Refresh token expired or revoked
2. **invalid_client**: Client credentials incorrect
3. **access_denied**: User denied authorization
4. **invalid_scope**: Requested scopes not granted

### Error Handling Strategy
```typescript
// src/lib/oauth/error-handler.ts
class OAuthErrorHandler {
  static handle(error: any, provider: string): OAuthError {
    if (error.response?.data) {
      const { error: errorCode, error_description } = error.response.data;
      
      switch (errorCode) {
        case 'invalid_grant':
          return {
            type: 'TOKEN_EXPIRED',
            message: 'Authorization has expired. Please reconnect.',
            action: 'REAUTHENTICATE',
          };
        case 'access_denied':
          return {
            type: 'ACCESS_DENIED',
            message: 'Authorization was denied.',
            action: 'RETRY',
          };
        case 'invalid_scope':
          return {
            type: 'INVALID_SCOPE',
            message: 'Requested permissions are not available.',
            action: 'RECONFIGURE',
          };
        default:
          return {
            type: 'UNKNOWN',
            message: error_description || 'An unknown error occurred.',
            action: 'CONTACT_SUPPORT',
          };
      }
    }
    
    return {
      type: 'NETWORK_ERROR',
      message: 'Unable to connect to the service.',
      action: 'RETRY',
    };
  }
}
```

## Testing Strategy

### Unit Tests
- Token encryption/decryption
- OAuth URL generation
- Token exchange logic
- Token refresh logic

### Integration Tests
- Complete OAuth flow with test providers
- Token refresh scenarios
- Error handling
- State verification

### End-to-End Tests
- User initiates OAuth flow
- Callback processing
- Token storage
- API calls with valid tokens
- Token refresh during API calls

## Environment Variables

```env
# OAuth Configuration
CALCOM_CLIENT_ID=your_calcom_client_id
CALCOM_CLIENT_SECRET=your_calcom_client_secret

ZOOM_CLIENT_ID=your_zoom_client_id
ZOOM_CLIENT_SECRET=your_zoom_client_secret

GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret

# Encryption
ENCRYPTION_KEY=your_32_character_encryption_key

# Application URLs
APP_URL=https://your-app.com
```

## Next Steps
1. Implement OAuth service layer
2. Create encryption service
3. Set up token management
4. Implement callback handlers
5. Create background refresh job
6. Add error handling and logging
7. Write comprehensive tests
8. Document API endpoints
