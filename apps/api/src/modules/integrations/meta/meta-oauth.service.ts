import { Injectable, BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Integration } from '../integration.entity';
import { IntegrationAccount } from '../integration-account.entity';
import { IntegrationAccountType } from '../integration-account-type.enum';
import { IntegrationProvider } from '../integration-provider.enum';
import { IntegrationStatus } from '../integration-status.enum';
import { protectSecret } from '../../../shared/security/integration-secrets';
import { MetaConversionOutbox } from './meta-conversion-outbox.entity';
import { MetaLeadWebhookEvent } from './meta-lead-webhook-event.entity';
import { MetaIntegrationAccessor } from './meta-integration-accessor.service';
import { MetaAssetDiscoveryService } from './meta-asset-discovery.service';

/**
 * OAuth connection lifecycle for Meta: authorize, exchange tokens, refresh, disconnect,
 * plus the pixel config and health-check surface built on top of it.
 * Asset discovery/selection lives in MetaAssetDiscoveryService.
 */
@Injectable()
export class MetaOAuthService {
  constructor(
    @InjectRepository(Integration) private readonly integrations: Repository<Integration>,
    @InjectRepository(IntegrationAccount) private readonly accounts: Repository<IntegrationAccount>,
    @InjectRepository(MetaConversionOutbox) private readonly conversionOutbox: Repository<MetaConversionOutbox>,
    @InjectRepository(MetaLeadWebhookEvent) private readonly leadEvents: Repository<MetaLeadWebhookEvent>,
    private readonly accessor: MetaIntegrationAccessor,
    private readonly assets: MetaAssetDiscoveryService,
  ) {}

  getAuthorizationUrl(redirectUri: string, state: string): string {
    const appId = process.env.META_APP_ID;
    if (!appId || !process.env.META_APP_SECRET) {
      throw new ServiceUnavailableException('Meta aún no está configurado en el entorno del servidor');
    }
    const scopes = this.getAuthorizationScopes().join(',');
    const version = process.env.META_GRAPH_API_VERSION ?? 'v23.0';
    return `https://www.facebook.com/${version}/dialog/oauth?client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scopes}&response_type=code&state=${encodeURIComponent(state)}`;
  }

  getAppId(): string | undefined {
    return process.env.META_APP_ID;
  }

  isConfigured(): boolean {
    return !!(process.env.META_APP_ID && process.env.META_APP_SECRET);
  }

  async disconnectIntegration(id: string, organizationId: string): Promise<Integration> {
    const integration = await this.integrations.findOne({
      where: { id, organizationId, provider: IntegrationProvider.META },
    });
    if (!integration) throw new BadRequestException('Meta integration not found');
    const accounts = await this.accounts.find({ where: { integrationId: id } });
    const pages = accounts.filter((account) => account.accountType === IntegrationAccountType.PAGE && account.metadata?.selected);
    try {
      await this.assets.unsubscribePages(pages);
      const token = this.accessor.getAccessToken(integration);
      if (token) {
        const version = process.env.META_GRAPH_API_VERSION ?? 'v23.0';
        await fetch(`https://graph.facebook.com/${version}/me/permissions`, {
          method: 'DELETE',
          headers: { authorization: `Bearer ${token}` },
          signal: AbortSignal.timeout(10000),
        });
      }
    } catch {
      // Credentials are removed locally even if Meta is temporarily unavailable.
    }
    for (const account of accounts) {
      // TypeORM skips undefined fields on save; null guarantees credentials are removed.
      account.accessToken = null as unknown as string;
      account.refreshToken = null as unknown as string;
      account.tokenExpiresAt = null as unknown as Date;
      account.metadata = { ...account.metadata, selected: false };
      await this.accounts.save(account);
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
    const shortLived = await this.exchangeCode(code, redirectUri);
    const longLived = await this.exchangeForLongLivedToken(shortLived.access_token);
    const profile = await this.fetchGraph<{ id: string }>(
      process.env.META_GRAPH_API_VERSION ?? 'v23.0',
      '/me',
      longLived.access_token,
      { fields: 'id' },
    );

    return this.upsertIntegration(organizationId, {
      config: {
        accessToken: protectSecret(longLived.access_token),
        metaUserId: profile.id,
        tokenType: longLived.token_type ?? shortLived.token_type,
        expiresIn: longLived.expires_in ?? shortLived.expires_in,
        scopes: this.getAuthorizationScopes(),
        expiresAt: (longLived.expires_in ?? shortLived.expires_in)
          ? new Date(Date.now() + (longLived.expires_in ?? shortLived.expires_in)! * 1000).toISOString()
          : undefined,
      },
      status: IntegrationStatus.ACTIVE,
    });
  }

  async refreshIntegration(id: string, organizationId: string): Promise<Integration> {
    const integration = await this.integrations.findOne({
      where: { id, organizationId, provider: IntegrationProvider.META },
    });
    if (!integration) throw new BadRequestException('Meta integration not found');

    const currentToken = this.accessor.getAccessToken(integration);
    if (!currentToken) throw new BadRequestException('Meta access token is missing');

    const longLived = await this.exchangeForLongLivedToken(currentToken);
    integration.status = IntegrationStatus.ACTIVE;
    integration.lastSyncAt = new Date();
    integration.errorMessage = undefined;
    integration.config = {
      ...integration.config,
      accessToken: protectSecret(longLived.access_token),
      tokenType: longLived.token_type ?? integration.config?.tokenType,
      scopes: integration.config?.scopes ?? this.getAuthorizationScopes(),
      expiresIn: longLived.expires_in,
      expiresAt: longLived.expires_in
        ? new Date(Date.now() + longLived.expires_in * 1000).toISOString()
        : integration.config?.expiresAt,
    };
    return this.integrations.save(integration);
  }

  async getIntegrationHealth(integrationId: string, organizationId: string) {
    const integration = await this.accessor.requireIntegration(integrationId, organizationId);
    const assets = await this.assets.getAssets(integrationId, organizationId);
    const expiresAt = typeof integration.config?.expiresAt === 'string' ? integration.config.expiresAt : null;
    const [capiPending, capiFailed, leadEventsProcessed, leadEventsFailed] = await Promise.all([
      this.conversionOutbox.count({ where: [{ organizationId, status: 'pending' }, { organizationId, status: 'retry' }] }),
      this.conversionOutbox.count({ where: { organizationId, status: 'failed' } }),
      this.leadEvents.count({ where: { organizationId, processingStatus: 'processed' } }),
      this.leadEvents.count({ where: { organizationId, processingStatus: 'error' } }),
    ]);
    const webhookBaseUrl = process.env.API_PUBLIC_URL?.replace(/\/$/, '');
    const webhookConfigured = Boolean(
      process.env.META_APP_SECRET &&
      process.env.META_WEBHOOK_VERIFY_TOKEN &&
      webhookBaseUrl,
    );
    const pixelId = typeof integration.config?.pixelId === 'string' ? integration.config.pixelId : null;
    const selectedCount: number =
      assets.pages.filter((asset) => asset.selected).length +
      assets.instagramProfiles.filter((asset) => asset.selected).length +
      assets.adAccounts.filter((asset) => asset.selected).length;

    return {
      connected: integration.status === IntegrationStatus.ACTIVE,
      tokenExpiresAt: expiresAt,
      selectedAssets: selectedCount,
      scopes: Array.isArray(integration.config?.scopes) ? integration.config.scopes : [],
      leadCaptureReady:
        webhookConfigured &&
        Array.isArray(integration.config?.selectedPageIds) &&
        integration.config.selectedPageIds.length > 0 &&
        Array.isArray(integration.config?.scopes) &&
        integration.config.scopes.includes('leads_retrieval') &&
        integration.config.scopes.includes('pages_manage_metadata'),
      credentialsEncrypted:
        typeof integration.config?.accessToken === 'string' &&
        integration.config.accessToken.startsWith('enc:v1:'),
      pixelId,
      conversionsTokenSource: process.env.META_CONVERSIONS_ACCESS_TOKEN ? 'dedicated' : 'oauth',
      webhookConfigured,
      webhookUrl: webhookBaseUrl ? `${webhookBaseUrl}/webhooks/meta` : null,
      capiConfigured: Boolean(pixelId && (process.env.META_CONVERSIONS_ACCESS_TOKEN || integration.config?.accessToken)),
      capiPending,
      capiFailed,
      leadEventsProcessed,
      leadEventsFailed,
    };
  }

  async getSecureAccessToken(integrationId: string, organizationId: string): Promise<string> {
    return this.accessor.getAccessToken(await this.accessor.requireIntegration(integrationId, organizationId));
  }

  async savePixelId(integrationId: string, organizationId: string, pixelId: string): Promise<void> {
    const integration = await this.accessor.requireIntegration(integrationId, organizationId);
    integration.config = { ...integration.config, pixelId };
    integration.lastSyncAt = new Date();
    await this.integrations.save(integration);
  }

  async getPixelId(integrationId: string, organizationId: string): Promise<string | null> {
    const integration = await this.accessor.requireIntegration(integrationId, organizationId);
    return typeof integration.config?.pixelId === 'string' ? integration.config.pixelId : null;
  }

  async handleDataDeletion(metaUserId: string): Promise<void> {
    const candidates = await this.integrations.find({
      where: { provider: IntegrationProvider.META },
    });
    const integration = candidates.find((item) => item.config?.metaUserId === metaUserId);
    if (!integration) return;

    await this.accounts.delete({ integrationId: integration.id });
    const { accessToken: _accessToken, metaUserId: _metaUserId, clientPixels: _clientPixels, ...retainedConfig } = integration.config ?? {};
    integration.config = {
      ...retainedConfig,
      dataDeletedAt: new Date().toISOString(),
    };
    integration.status = IntegrationStatus.DISABLED;
    integration.errorMessage = 'Meta data deletion request completed';
    await this.integrations.save(integration);
  }

  private getAuthorizationScopes(): string[] {
    return [
      'ads_read',
      'leads_retrieval',
      'pages_show_list',
      'instagram_basic',
      'instagram_manage_messages',
      'pages_messaging',
      'pages_manage_metadata',
      'pages_read_engagement',
      'business_management',
    ];
  }

  private async exchangeCode(code: string, redirectUri: string): Promise<MetaTokenResponse> {
    const appId = process.env.META_APP_ID;
    const appSecret = process.env.META_APP_SECRET;
    const version = process.env.META_GRAPH_API_VERSION ?? 'v23.0';
    if (!appId || !appSecret) throw new BadRequestException('Meta OAuth is not configured');

    const params = new URLSearchParams({
      client_id: appId,
      client_secret: appSecret,
      redirect_uri: redirectUri,
      code,
    });

    // A more generous timeout than the 15s used elsewhere in this file: this call sits inside
    // the interactive OAuth callback, with an admin actively waiting after authorizing on
    // Meta's side. Timing out here doesn't just fail one request — it forces the admin to
    // restart the entire consent flow from scratch, which is far more disruptive than a few
    // extra seconds of waiting.
    const response = await fetch(`https://graph.facebook.com/${version}/oauth/access_token?${params.toString()}`, { signal: AbortSignal.timeout(25000) });
    const data = await response.json() as MetaTokenResponse | MetaErrorResponse;
    if (!response.ok) {
      throw new BadRequestException('Meta OAuth token exchange failed');
    }
    return data as MetaTokenResponse;
  }

  private async exchangeForLongLivedToken(accessToken: string): Promise<MetaTokenResponse> {
    const appId = process.env.META_APP_ID;
    const appSecret = process.env.META_APP_SECRET;
    const version = process.env.META_GRAPH_API_VERSION ?? 'v23.0';
    if (!appId || !appSecret) throw new BadRequestException('Meta OAuth is not configured');

    const params = new URLSearchParams({
      grant_type: 'fb_exchange_token',
      client_id: appId,
      client_secret: appSecret,
      fb_exchange_token: accessToken,
    });

    // Same rationale as exchangeCode(): this backs both the initial OAuth connect and the
    // admin-triggered "refresh" action, both interactive — see comment there.
    const response = await fetch(`https://graph.facebook.com/${version}/oauth/access_token?${params.toString()}`, { signal: AbortSignal.timeout(25000) });
    const data = await response.json() as MetaTokenResponse | MetaErrorResponse;
    if (!response.ok) {
      throw new BadRequestException('Meta token refresh failed');
    }
    return data as MetaTokenResponse;
  }

  private async upsertIntegration(
    organizationId: string,
    data: Pick<Integration, 'config' | 'status'>,
  ): Promise<Integration> {
    const existing = await this.integrations.findOne({
      where: { organizationId, provider: IntegrationProvider.META },
    });

    if (existing) {
      existing.status = data.status;
      existing.config = { ...existing.config, ...data.config };
      existing.lastSyncAt = new Date();
      existing.errorMessage = undefined;
      return this.integrations.save(existing);
    }

    const integration = this.integrations.create({
      organizationId,
      provider: IntegrationProvider.META,
      name: 'Meta',
      status: data.status,
      config: data.config,
      lastSyncAt: new Date(),
    });
    return this.integrations.save(integration);
  }

  private async fetchGraph<T>(
    version: string,
    path: string,
    accessToken: string,
    params: Record<string, string>,
  ): Promise<T> {
    const query = new URLSearchParams(params).toString();
    const response = await fetch(`https://graph.facebook.com/${version}${path}?${query}`, {
      headers: { authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(15000),
    });
    const data = await response.json() as T | MetaErrorResponse;
    if (!response.ok) throw new BadRequestException('Meta asset discovery failed');
    return data as T;
  }
}

interface MetaTokenResponse {
  access_token: string;
  token_type?: string;
  expires_in?: number;
}

interface MetaErrorResponse {
  error: {
    message: string;
    type: string;
    code: number;
  };
}
