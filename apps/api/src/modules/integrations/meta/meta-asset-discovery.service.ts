import { Injectable, BadRequestException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Integration } from '../integration.entity';
import { IntegrationAccount } from '../integration-account.entity';
import { IntegrationAccountType } from '../integration-account-type.enum';
import { protectSecret, revealSecret } from '../../../shared/security/integration-secrets';
import type { MetaAssetSelectionDto } from './dto/meta-integration.dto';
import { MetaIntegrationAccessor } from './meta-integration-accessor.service';

/**
 * Discovers, persists, and manages selection of Meta pages, Instagram profiles,
 * and ad accounts for an integration (webhook subscriptions included).
 */
@Injectable()
export class MetaAssetDiscoveryService {
  constructor(
    @InjectRepository(Integration) private readonly integrations: Repository<Integration>,
    @InjectRepository(IntegrationAccount) private readonly accounts: Repository<IntegrationAccount>,
    private readonly accessor: MetaIntegrationAccessor,
  ) {}

  async discoverAssets(integrationId: string, organizationId: string): Promise<MetaAssetsResponse> {
    const integration = await this.accessor.requireIntegration(integrationId, organizationId);
    const accessToken = this.accessor.getAccessToken(integration);
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
    await this.accessor.requireIntegration(integrationId, organizationId);
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
    const integration = await this.accessor.requireIntegration(integrationId, organizationId);
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

  async subscribeSelectedPages(pages: IntegrationAccount[]) {
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

  async unsubscribePages(pages: IntegrationAccount[]) {
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

interface MetaErrorResponse {
  error: {
    message: string;
    type: string;
    code: number;
  };
}
