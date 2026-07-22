import { Injectable, BadRequestException, ConflictException, ServiceUnavailableException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Integration } from '../integration.entity';
import { IntegrationAccount } from '../integration-account.entity';
import { IntegrationAccountType } from '../integration-account-type.enum';
import { IntegrationProvider } from '../integration-provider.enum';
import { IntegrationStatus } from '../integration-status.enum';
import { protectSecret, revealSecret } from '../../../shared/security/integration-secrets';
import type { MetaAssetSelectionDto } from './dto/meta-integration.dto';
import { MetaConversionOutbox } from './meta-conversion-outbox.entity';
import { MetaLeadWebhookEvent } from './meta-lead-webhook-event.entity';

@Injectable()
export class MetaOAuthService {
  constructor(
    @InjectRepository(Integration) private readonly integrations: Repository<Integration>,
    @InjectRepository(IntegrationAccount) private readonly accounts: Repository<IntegrationAccount>,
    @InjectRepository(MetaConversionOutbox) private readonly conversionOutbox: Repository<MetaConversionOutbox>,
    @InjectRepository(MetaLeadWebhookEvent) private readonly leadEvents: Repository<MetaLeadWebhookEvent>,
  ) {}

  getAuthorizationUrl(redirectUri: string, state: string): string {
    const appId = process.env.META_APP_ID;
    if (!appId || !process.env.META_APP_SECRET) {
      throw new ServiceUnavailableException('Meta aún no está configurado en el entorno del servidor');
    }
    const scopes = [
      'ads_read', 'leads_retrieval',
      'pages_show_list', 'instagram_basic', 'instagram_manage_messages', 'pages_messaging',
      'pages_manage_metadata',
      'pages_read_engagement', 'business_management',
    ].join(',');
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
      await this.unsubscribePages(pages);
      const token = this.getIntegrationAccessToken(integration);
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

    const currentToken = this.getIntegrationAccessToken(integration);
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

  async discoverAssets(integrationId: string, organizationId: string): Promise<MetaAssetsResponse> {
    const integration = await this.requireIntegration(integrationId, organizationId);
    const accessToken = this.getIntegrationAccessToken(integration);
    const version = process.env.META_GRAPH_API_VERSION ?? 'v23.0';

    const [pagesResponse, adAccountsResponse] = await Promise.all([
      this.fetchGraph<MetaPagesResponse>(version, '/me/accounts', accessToken, {
        fields: 'id,name,access_token,category,connected_instagram_account{id,username}',
      }),
      this.fetchGraph<MetaAdAccountsResponse>(version, '/me/adaccounts', accessToken, {
        fields: 'id,name,account_status,currency,timezone_name',
      }),
    ]);

    const pages = (pagesResponse.data ?? []).map((page) => ({
      id: page.id,
      name: page.name,
      category: page.category,
      selected: false,
      accessToken: page.access_token,
      connectedInstagram: page.connected_instagram_account
        ? { id: page.connected_instagram_account.id, name: page.connected_instagram_account.username }
        : undefined,
    }));

    const instagramProfiles = pages
      .filter((page) => page.connectedInstagram)
      .map((page) => ({
        id: page.connectedInstagram!.id,
        name: page.connectedInstagram!.name,
        selected: false,
        pageId: page.id,
      }));

    const adAccounts = (adAccountsResponse.data ?? []).map((account) => ({
      id: account.id,
      name: account.name,
      selected: false,
      accountStatus: account.account_status,
      currency: account.currency,
      timezoneName: account.timezone_name,
    }));

    await this.syncDiscoveredAssets(integration.id, pages, instagramProfiles, adAccounts);
    return this.getAssets(integration.id, organizationId);
  }

  async getAssets(integrationId: string, organizationId: string): Promise<MetaAssetsResponse> {
    await this.requireIntegration(integrationId, organizationId);
    const accounts = await this.accounts.find({ where: { integrationId }, order: { externalName: 'ASC' } });

    const pages = accounts
      .filter((account) => account.accountType === IntegrationAccountType.PAGE)
      .map((account) => ({
        recordId: account.id,
        id: account.externalId,
        name: account.externalName,
        selected: Boolean(account.metadata?.selected),
        category: typeof account.metadata?.category === 'string' ? account.metadata.category : undefined,
      }));

    const instagramProfiles = accounts
      .filter((account) => account.accountType === IntegrationAccountType.PROFILE)
      .map((account) => ({
        recordId: account.id,
        id: account.externalId,
        name: account.externalName,
        selected: Boolean(account.metadata?.selected),
        pageId: typeof account.metadata?.pageId === 'string' ? account.metadata.pageId : undefined,
      }));

    const adAccounts = accounts
      .filter((account) => account.accountType === IntegrationAccountType.AD_ACCOUNT)
      .map((account) => ({
        recordId: account.id,
        id: account.externalId,
        name: account.externalName,
        selected: Boolean(account.metadata?.selected),
        accountStatus: typeof account.metadata?.accountStatus === 'number' ? account.metadata.accountStatus : undefined,
        currency: typeof account.metadata?.currency === 'string' ? account.metadata.currency : undefined,
        timezoneName: typeof account.metadata?.timezoneName === 'string' ? account.metadata.timezoneName : undefined,
        clientId: typeof account.metadata?.clientId === 'string' ? account.metadata.clientId : undefined,
      }));

    return { pages, instagramProfiles, adAccounts };
  }

  async saveSelectedAssets(
    integrationId: string,
    organizationId: string,
    selection: MetaAssetSelectionDto,
  ): Promise<{ saved: boolean; assets: MetaAssetsResponse }> {
    const integration = await this.requireIntegration(integrationId, organizationId);
    const accounts = await this.accounts.find({ where: { integrationId } });

    const selectedPageIds = new Set(selection.pageIds ?? []);
    const selectedProfileIds = new Set(selection.instagramProfileIds ?? []);
    const selectedAdAccountIds = new Set(selection.adAccountIds ?? []);

    this.validateAssetSelection(accounts, IntegrationAccountType.PAGE, selectedPageIds, 'pagina');
    this.validateAssetSelection(accounts, IntegrationAccountType.PROFILE, selectedProfileIds, 'perfil de Instagram');
    this.validateAssetSelection(accounts, IntegrationAccountType.AD_ACCOUNT, selectedAdAccountIds, 'cuenta publicitaria');
    this.validatePrimary(selection.primaryPageId, selectedPageIds, 'pagina principal');
    this.validatePrimary(selection.primaryInstagramProfileId, selectedProfileIds, 'perfil principal');
    this.validatePrimary(selection.primaryAdAccountId, selectedAdAccountIds, 'cuenta publicitaria principal');

    const selectedPages = accounts.filter((account) =>
      account.accountType === IntegrationAccountType.PAGE && selectedPageIds.has(account.externalId),
    );
    await this.assertPagesAreExclusive(selectedPages, integrationId, organizationId);
    const deselectedPages = accounts.filter((account) =>
      account.accountType === IntegrationAccountType.PAGE && Boolean(account.metadata?.selected) && !selectedPageIds.has(account.externalId),
    );

    await this.subscribeSelectedPages(selectedPages);
    await this.unsubscribePages(deselectedPages);

    for (const account of accounts) {
      if (account.accountType === IntegrationAccountType.PAGE) {
        account.metadata = { ...account.metadata, selected: selectedPageIds.has(account.externalId) };
      }
      if (account.accountType === IntegrationAccountType.PROFILE) {
        account.metadata = { ...account.metadata, selected: selectedProfileIds.has(account.externalId) };
      }
      if (account.accountType === IntegrationAccountType.AD_ACCOUNT) {
        account.metadata = { ...account.metadata, selected: selectedAdAccountIds.has(account.externalId) };
      }
    }

    await this.accounts.save(accounts);

    integration.config = {
      ...integration.config,
      selectedPageIds: [...selectedPageIds],
      selectedInstagramProfileIds: [...selectedProfileIds],
      selectedAdAccountIds: [...selectedAdAccountIds],
      primaryPageId: selection.primaryPageId ?? [...selectedPageIds][0] ?? null,
      primaryInstagramProfileId: selection.primaryInstagramProfileId ?? [...selectedProfileIds][0] ?? null,
      primaryAdAccountId: selection.primaryAdAccountId ?? [...selectedAdAccountIds][0] ?? null,
    };
    integration.lastSyncAt = new Date();
    await this.integrations.save(integration);

    return { saved: true, assets: await this.getAssets(integrationId, organizationId) };
  }

  async getIntegrationHealth(integrationId: string, organizationId: string) {
    const integration = await this.requireIntegration(integrationId, organizationId);
    const assets = await this.getAssets(integrationId, organizationId);
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
    const selectedCount =
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
    return this.getIntegrationAccessToken(await this.requireIntegration(integrationId, organizationId));
  }

  async savePixelId(integrationId: string, organizationId: string, pixelId: string): Promise<void> {
    const integration = await this.requireIntegration(integrationId, organizationId);
    integration.config = { ...integration.config, pixelId };
    integration.lastSyncAt = new Date();
    await this.integrations.save(integration);
  }

  async getPixelId(integrationId: string, organizationId: string): Promise<string | null> {
    const integration = await this.requireIntegration(integrationId, organizationId);
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

    const response = await fetch(`https://graph.facebook.com/${version}/oauth/access_token?${params.toString()}`);
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

    const response = await fetch(`https://graph.facebook.com/${version}/oauth/access_token?${params.toString()}`);
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

  private async requireIntegration(id: string, organizationId: string): Promise<Integration> {
    const integration = await this.integrations.findOne({
      where: { id, organizationId, provider: IntegrationProvider.META },
    });
    if (!integration) throw new BadRequestException('Meta integration not found');
    return integration;
  }

  private getIntegrationAccessToken(integration: Integration): string {
    const stored = typeof integration.config?.accessToken === 'string' ? integration.config.accessToken : '';
    const accessToken = revealSecret(stored) ?? '';
    if (!accessToken) throw new BadRequestException('Meta access token is missing');
    return accessToken;
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

  private async syncDiscoveredAssets(
    integrationId: string,
    pages: Array<{ id: string; name: string; category?: string; selected: boolean; accessToken?: string; connectedInstagram?: { id: string; name: string } }>,
    instagramProfiles: Array<{ id: string; name: string; selected: boolean; pageId: string }>,
    adAccounts: Array<{ id: string; name: string; selected: boolean; accountStatus?: number; currency?: string; timezoneName?: string }>,
  ) {
    const existing = await this.accounts.find({ where: { integrationId } });
    const byKey = new Map(existing.map((account) => [`${account.accountType}:${account.externalId}`, account]));

    for (const page of pages) {
      const key = `${IntegrationAccountType.PAGE}:${page.id}`;
      const record = byKey.get(key) ?? this.accounts.create({ integrationId, accountType: IntegrationAccountType.PAGE, externalId: page.id, externalName: page.name });
      record.externalName = page.name;
      record.accessToken = page.accessToken ? protectSecret(page.accessToken) : record.accessToken;
      record.metadata = {
        ...record.metadata,
        category: page.category,
        selected: Boolean(record.metadata?.selected),
      };
      await this.accounts.save(record);
    }

    for (const profile of instagramProfiles) {
      const key = `${IntegrationAccountType.PROFILE}:${profile.id}`;
      const record = byKey.get(key) ?? this.accounts.create({ integrationId, accountType: IntegrationAccountType.PROFILE, externalId: profile.id, externalName: profile.name });
      record.externalName = profile.name;
      record.metadata = {
        ...record.metadata,
        pageId: profile.pageId,
        selected: Boolean(record.metadata?.selected),
      };
      await this.accounts.save(record);
    }

    for (const adAccount of adAccounts) {
      const key = `${IntegrationAccountType.AD_ACCOUNT}:${adAccount.id}`;
      const record = byKey.get(key) ?? this.accounts.create({ integrationId, accountType: IntegrationAccountType.AD_ACCOUNT, externalId: adAccount.id, externalName: adAccount.name });
      record.externalName = adAccount.name;
      record.metadata = {
        ...record.metadata,
        accountStatus: adAccount.accountStatus,
        currency: adAccount.currency,
        timezoneName: adAccount.timezoneName,
        selected: Boolean(record.metadata?.selected),
      };
      await this.accounts.save(record);
    }
  }

  private async subscribeSelectedPages(pages: IntegrationAccount[]) {
    const version = process.env.META_GRAPH_API_VERSION ?? 'v23.0';
    const subscribedFields = [
      'leadgen',
      'messages',
      'messaging_postbacks',
      'message_deliveries',
      'message_reads',
    ].join(',');
    await Promise.all(
      pages.map(async (page) => {
        const accessToken = revealSecret(page.accessToken);
        if (!accessToken) throw new BadRequestException(`La pagina ${page.externalName} no tiene un token valido; vuelve a descubrir los activos`);
        const body = new URLSearchParams({ subscribed_fields: subscribedFields });
        const response = await fetch(`https://graph.facebook.com/${version}/${page.externalId}/subscribed_apps`, {
          method: 'POST',
          headers: {
            authorization: `Bearer ${accessToken}`,
            'content-type': 'application/x-www-form-urlencoded',
          },
          body: body.toString(),
          signal: AbortSignal.timeout(15000),
        });
        if (!response.ok) throw new BadRequestException(`Meta subscription failed for page ${page.externalId}`);
      }),
    );
  }

  private async unsubscribePages(pages: IntegrationAccount[]) {
    const version = process.env.META_GRAPH_API_VERSION ?? 'v23.0';
    await Promise.all(pages.map(async (page) => {
      const accessToken = revealSecret(page.accessToken);
      if (!accessToken) return;
      const response = await fetch(`https://graph.facebook.com/${version}/${page.externalId}/subscribed_apps`, {
        method: 'DELETE',
        headers: { authorization: `Bearer ${accessToken}` },
        signal: AbortSignal.timeout(15000),
      });
      if (!response.ok) throw new BadRequestException(`No se pudo desuscribir la pagina ${page.externalName}`);
    }));
  }

  private validateAssetSelection(
    accounts: IntegrationAccount[],
    type: IntegrationAccountType,
    selectedIds: Set<string>,
    label: string,
  ): void {
    const available = new Set(accounts.filter((account) => account.accountType === type).map((account) => account.externalId));
    const unknown = [...selectedIds].find((id) => !available.has(id));
    if (unknown) throw new BadRequestException(`La ${label} ${unknown} no pertenece a esta integracion`);
  }

  private validatePrimary(primaryId: string | null | undefined, selectedIds: Set<string>, label: string): void {
    if (primaryId && !selectedIds.has(primaryId)) throw new BadRequestException(`La ${label} debe estar seleccionada`);
  }

  private async assertPagesAreExclusive(
    selectedPages: IntegrationAccount[],
    integrationId: string,
    organizationId: string,
  ): Promise<void> {
    for (const page of selectedPages) {
      const matches = await this.accounts.find({
        where: { accountType: IntegrationAccountType.PAGE, externalId: page.externalId },
        relations: { integration: true },
      });
      const conflict = matches.find((candidate) =>
        candidate.integrationId !== integrationId &&
        candidate.integration.organizationId !== organizationId &&
        Boolean(candidate.metadata?.selected),
      );
      if (conflict) {
        throw new ConflictException(`La pagina ${page.externalName} ya esta activa en otra organizacion`);
      }
    }
  }
}

interface MetaPagesResponse {
  data?: Array<{
    id: string;
    name: string;
    access_token?: string;
    category?: string;
    connected_instagram_account?: { id: string; username: string };
  }>;
}

interface MetaAdAccountsResponse {
  data?: Array<{
    id: string;
    name: string;
    account_status?: number;
    currency?: string;
    timezone_name?: string;
  }>;
}

export interface MetaAssetsResponse {
  pages: Array<{ recordId: string; id: string; name: string; selected: boolean; category?: string }>;
  instagramProfiles: Array<{ recordId: string; id: string; name: string; selected: boolean; pageId?: string }>;
  adAccounts: Array<{ recordId: string; id: string; name: string; selected: boolean; clientId?: string; accountStatus?: number; currency?: string; timezoneName?: string }>;
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
