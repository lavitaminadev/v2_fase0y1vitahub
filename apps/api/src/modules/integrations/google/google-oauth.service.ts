import { Injectable, BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Integration } from '../integration.entity';
import { IntegrationProvider } from '../integration-provider.enum';
import { IntegrationStatus } from '../integration-status.enum';
import { protectSecret, revealSecret } from '../../../shared/security/integration-secrets';

@Injectable()
export class GoogleOAuthService {
  constructor(
    @InjectRepository(Integration) private readonly integrations: Repository<Integration>,
  ) {}

  getAuthorizationUrl(redirectUri: string, state: string): string {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId || !process.env.GOOGLE_CLIENT_SECRET) {
      throw new ServiceUnavailableException('Google aún no está configurado en el entorno del servidor');
    }
    const scopes = [
      'https://www.googleapis.com/auth/adwords',
      'https://www.googleapis.com/auth/analytics.readonly',
      'https://www.googleapis.com/auth/drive.file',
      'https://www.googleapis.com/auth/calendar.events',
    ].join(' ');
    return `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(scopes)}&access_type=offline&prompt=consent&state=${encodeURIComponent(state)}`;
  }

  getClientId(): string | undefined {
    return process.env.GOOGLE_CLIENT_ID;
  }

  isConfigured(): boolean {
    return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
  }

  async disconnectIntegration(id: string, organizationId: string): Promise<Integration> {
    const integration = await this.integrations.findOne({
      where: { id, organizationId, provider: IntegrationProvider.GOOGLE },
    });
    if (!integration) throw new BadRequestException('Google integration not found');

    const token = revealSecret(
      typeof integration.config?.accessToken === 'string' ? integration.config.accessToken : undefined,
    );
    if (token) {
      try {
        await fetch('https://oauth2.googleapis.com/revoke', {
          method: 'POST',
          headers: { 'content-type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ token }),
          signal: AbortSignal.timeout(10000),
        });
      } catch {
        // Local credentials are cleared even when Google's revoke endpoint is unavailable.
      }
    }

    integration.status = IntegrationStatus.DISABLED;
    integration.config = {};
    integration.errorMessage = undefined;
    return this.integrations.save(integration);
  }

  async connectWithCode(
    organizationId: string,
    code: string,
    redirectUri: string,
  ): Promise<Integration> {
    const tokens = await this.exchangeCode(code, redirectUri);
    return this.upsertIntegration(organizationId, {
      config: {
        accessToken: protectSecret(tokens.access_token),
        refreshToken: tokens.refresh_token ? protectSecret(tokens.refresh_token) : undefined,
        scope: tokens.scope,
        tokenType: tokens.token_type,
        expiryDate: tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000).toISOString() : undefined,
      },
      status: IntegrationStatus.ACTIVE,
    });
  }

  async refreshIntegration(id: string, organizationId: string): Promise<Integration> {
    const integration = await this.integrations.findOne({
      where: { id, organizationId, provider: IntegrationProvider.GOOGLE },
    });
    if (!integration) throw new BadRequestException('Google integration not found');

    const refreshToken = revealSecret(
      typeof integration.config?.refreshToken === 'string' ? integration.config.refreshToken : undefined,
    );

    if (!refreshToken) throw new BadRequestException('Google refresh token is missing');

    const tokens = await this.refreshAccessToken(refreshToken);
    integration.status = IntegrationStatus.ACTIVE;
    integration.lastSyncAt = new Date();
    integration.errorMessage = undefined;
    integration.config = {
      ...integration.config,
      accessToken: protectSecret(tokens.access_token),
      tokenType: tokens.token_type,
      scope: tokens.scope ?? integration.config?.scope,
      expiryDate: tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000).toISOString() : integration.config?.expiryDate,
    };
    return this.integrations.save(integration);
  }

  private async exchangeCode(
    code: string,
    redirectUri: string,
  ): Promise<GoogleTokenResponse> {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    if (!clientId || !clientSecret) throw new BadRequestException('Google OAuth is not configured');

    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
      signal: AbortSignal.timeout(15000),
    });

    const data = await response.json() as GoogleTokenResponse | GoogleErrorResponse;
    if (!response.ok) {
      throw new BadRequestException('Google OAuth token exchange failed');
    }
    return data as GoogleTokenResponse;
  }

  private async refreshAccessToken(refreshToken: string): Promise<GoogleTokenResponse> {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    if (!clientId || !clientSecret) throw new BadRequestException('Google OAuth is not configured');

    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
      signal: AbortSignal.timeout(15000),
    });

    const data = await response.json() as GoogleTokenResponse | GoogleErrorResponse;
    if (!response.ok) {
      throw new BadRequestException('Google token refresh failed');
    }
    return data as GoogleTokenResponse;
  }

  private async upsertIntegration(
    organizationId: string,
    data: Pick<Integration, 'config' | 'status'>,
  ): Promise<Integration> {
    const existing = await this.integrations.findOne({
      where: { organizationId, provider: IntegrationProvider.GOOGLE },
    });

    if (existing) {
      existing.status = data.status;
      existing.config = data.config;
      existing.lastSyncAt = new Date();
      existing.errorMessage = undefined;
      return this.integrations.save(existing);
    }

    const integration = this.integrations.create({
      organizationId,
      provider: IntegrationProvider.GOOGLE,
      name: 'Google',
      status: data.status,
      config: data.config,
      lastSyncAt: new Date(),
    });
    return this.integrations.save(integration);
  }
}

interface GoogleTokenResponse {
  access_token: string;
  expires_in?: number;
  refresh_token?: string;
  scope?: string;
  token_type?: string;
}

interface GoogleErrorResponse {
  error: string;
  error_description?: string;
}
