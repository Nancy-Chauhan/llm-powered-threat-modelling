import { eq } from 'drizzle-orm';
import { db, oauthTokens } from '../db';

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';

// Drive read-only scope
const SCOPES = ['https://www.googleapis.com/auth/drive.readonly'];

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope: string;
  token_type: string;
}

export class GoogleOAuthService {
  private clientId: string;
  private clientSecret: string;
  private redirectUri: string;

  constructor() {
    this.clientId = process.env.GOOGLE_CLIENT_ID || '';
    this.clientSecret = process.env.GOOGLE_CLIENT_SECRET || '';
    this.redirectUri = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3001/api/oauth/google/callback';
  }

  getAuthorizationUrl(): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      response_type: 'code',
      scope: SCOPES.join(' '),
      access_type: 'offline',
      prompt: 'consent',
    });
    return `${GOOGLE_AUTH_URL}?${params.toString()}`;
  }

  async exchangeCode(code: string): Promise<{ accessToken: string; refreshToken: string; expiresAt: Date }> {
    const response = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        code,
        grant_type: 'authorization_code',
        redirect_uri: this.redirectUri,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Token exchange failed: ${error}`);
    }

    const data: TokenResponse = await response.json();
    const expiresAt = new Date(Date.now() + data.expires_in * 1000);

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token || '',
      expiresAt,
    };
  }

  async refreshAccessToken(refreshToken: string): Promise<{ accessToken: string; expiresAt: Date }> {
    const response = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Token refresh failed: ${error}`);
    }

    const data: TokenResponse = await response.json();
    const expiresAt = new Date(Date.now() + data.expires_in * 1000);

    return {
      accessToken: data.access_token,
      expiresAt,
    };
  }

  async saveTokens(accessToken: string, refreshToken: string, expiresAt: Date, scope?: string): Promise<void> {
    // Delete existing google_drive tokens first (only one connection at a time for simplicity)
    await db.delete(oauthTokens).where(eq(oauthTokens.provider, 'google_drive'));

    await db.insert(oauthTokens).values({
      provider: 'google_drive',
      accessToken,
      refreshToken,
      expiresAt,
      scope,
    });
  }

  async getValidAccessToken(): Promise<string | null> {
    const [token] = await db
      .select()
      .from(oauthTokens)
      .where(eq(oauthTokens.provider, 'google_drive'))
      .limit(1);

    if (!token) return null;

    // Check if token is expired (with 5 min buffer)
    const isExpired = token.expiresAt.getTime() < Date.now() + 5 * 60 * 1000;

    if (isExpired) {
      try {
        const { accessToken, expiresAt } = await this.refreshAccessToken(token.refreshToken);
        await db
          .update(oauthTokens)
          .set({ accessToken, expiresAt, updatedAt: new Date() })
          .where(eq(oauthTokens.id, token.id));
        return accessToken;
      } catch {
        // Refresh failed, token is invalid
        await db.delete(oauthTokens).where(eq(oauthTokens.id, token.id));
        return null;
      }
    }

    return token.accessToken;
  }

  async isConnected(): Promise<boolean> {
    const token = await this.getValidAccessToken();
    return token !== null;
  }

  async disconnect(): Promise<void> {
    await db.delete(oauthTokens).where(eq(oauthTokens.provider, 'google_drive'));
  }
}

export const googleOAuthService = new GoogleOAuthService();

export function isGoogleOAuthConfigured(): boolean {
  return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}
