import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Integration } from '../integration.entity';
import { IntegrationProvider } from '../integration-provider.enum';
import { IntegrationAccount } from '../integration-account.entity';
import { IntegrationAccountType } from '../integration-account-type.enum';
import { IntegrationMetric } from '../integration-metric.entity';
import { revealSecret } from '../../../shared/security/integration-secrets';
import { Client } from '../../clients/client.entity';
import { GoogleOAuthService } from './google-oauth.service';

@Injectable()
export class GoogleDataService {
  constructor(
    @InjectRepository(Integration) private readonly integrations: Repository<Integration>,
    @InjectRepository(IntegrationAccount) private readonly accounts: Repository<IntegrationAccount>,
    @InjectRepository(IntegrationMetric) private readonly metrics: Repository<IntegrationMetric>,
    @InjectRepository(Client) private readonly clients: Repository<Client>,
    private readonly oauth: GoogleOAuthService,
  ) {}

  async listAccounts(integrationId: string, organizationId: string) {
    await this.getIntegration(integrationId, organizationId);
    const accounts = await this.accounts.find({ where: { integrationId }, order: { externalName: 'ASC' } });
    return accounts.map((item) => ({
      id: item.id,
      externalId: item.externalId,
      name: item.externalName,
      type: item.accountType,
      selected: Boolean(item.metadata?.selected),
      clientId: typeof item.metadata?.clientId === 'string' ? item.metadata.clientId : null,
    }));
  }

  async discoverAdsAccounts(integrationId: string, organizationId: string) {
    const { integration, token } = await this.getAccess(integrationId, organizationId);
    const response = await this.googleFetch<{ resourceNames?: string[] }>(`https://googleads.googleapis.com/${this.adsApiVersion()}/customers:listAccessibleCustomers`, token, { headers: this.adsHeaders() });
    const discovered: IntegrationAccount[] = [];
    for (const resource of response.resourceNames ?? []) {
      const customerId = resource.replace('customers/', '');
      let account = await this.accounts.findOne({ where: { integrationId, accountType: IntegrationAccountType.AD_ACCOUNT, externalId: customerId } });
      account ??= this.accounts.create({ integrationId, accountType: IntegrationAccountType.AD_ACCOUNT, externalId: customerId, externalName: `Google Ads ${customerId}`, metadata: {} });
      account.metadata = { ...account.metadata, selected: account.metadata?.selected ?? false };
      discovered.push(await this.accounts.save(account));
    }
    integration.lastSyncAt = new Date(); await this.integrations.save(integration);
    return discovered.map((item) => ({ id: item.id, externalId: item.externalId, name: item.externalName, selected: Boolean(item.metadata?.selected), clientId: item.metadata?.clientId ?? null }));
  }

  async registerAnalyticsProperty(integrationId: string, organizationId: string, propertyId: string, name: string, clientId: string) {
    await this.getAccess(integrationId, organizationId);
    const client = await this.clients.findOne({ where: { id: clientId, organizationId } });
    if (!client) throw new BadRequestException('El cliente seleccionado no pertenece a esta organización');
    let account = await this.accounts.findOne({ where: { integrationId, accountType: IntegrationAccountType.ANALYTICS_PROPERTY, externalId: propertyId } });
    account ??= this.accounts.create({ integrationId, accountType: IntegrationAccountType.ANALYTICS_PROPERTY, externalId: propertyId, externalName: name });
    account.externalName = name.trim(); account.metadata = { ...account.metadata, selected: true, clientId: client.id };
    return this.accounts.save(account);
  }

  async sync(integrationId: string, organizationId: string) {
    const { token } = await this.getAccess(integrationId, organizationId);
    const accounts = await this.accounts.find({ where: { integrationId } });
    if (!accounts.some((item) => item.metadata?.selected)) {
      throw new BadRequestException('Asigna al menos una cuenta de Google a un cliente antes de sincronizar');
    }
    let synced = 0; const skipped: string[] = [];
    for (const account of accounts.filter((item) => item.metadata?.selected)) {
      const clientId = typeof account.metadata?.clientId === 'string' ? account.metadata.clientId : undefined;
      if (!clientId) { skipped.push(account.externalName); continue; }
      if (account.accountType === IntegrationAccountType.AD_ACCOUNT) synced += await this.syncAdsAccount(account, organizationId, clientId, token);
      if (account.accountType === IntegrationAccountType.ANALYTICS_PROPERTY) synced += await this.syncAnalyticsProperty(account, organizationId, clientId, token);
    }
    return { synced, skippedUnassignedAccounts: skipped };
  }

  private async syncAdsAccount(account: IntegrationAccount, organizationId: string, clientId: string, token: string) {
    const query = `SELECT segments.date, metrics.cost_micros, metrics.impressions, metrics.clicks, metrics.conversions FROM customer WHERE segments.date DURING LAST_30_DAYS`;
    const rows = await this.googleFetch<Array<{ results?: GoogleAdsRow[] }>>(`https://googleads.googleapis.com/${this.adsApiVersion()}/customers/${account.externalId}/googleAds:searchStream`, token, { method: 'POST', headers: this.adsHeaders(), body: JSON.stringify({ query }) });
    let count = 0;
    for (const row of rows.flatMap((batch) => batch.results ?? [])) {
      await this.upsertMetric({ organizationId, clientId, provider: 'google_ads', externalAccountId: account.externalId, metricDate: new Date(row.segments.date), spend: Number(row.metrics.costMicros ?? 0) / 1_000_000, impressions: Number(row.metrics.impressions ?? 0), clicks: Number(row.metrics.clicks ?? 0), conversions: Number(row.metrics.conversions ?? 0), reach: 0, leads: 0 }); count += 1;
    }
    return count;
  }

  private async syncAnalyticsProperty(account: IntegrationAccount, organizationId: string, clientId: string, token: string) {
    const property = account.externalId.replace('properties/', '');
    const payload = await this.googleFetch<GaReport>(`https://analyticsdata.googleapis.com/v1beta/properties/${property}:runReport`, token, { method: 'POST', body: JSON.stringify({ dateRanges: [{ startDate: '30daysAgo', endDate: 'today' }], dimensions: [{ name: 'date' }], metrics: [{ name: 'sessions' }, { name: 'conversions' }], limit: 100 }) });
    let count = 0;
    for (const row of payload.rows ?? []) {
      const raw = row.dimensionValues?.[0]?.value ?? '';
      const date = new Date(`${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`);
      await this.upsertMetric({ organizationId, clientId, provider: 'google_analytics', externalAccountId: account.externalId, metricDate: date, spend: 0, impressions: 0, reach: 0, clicks: Number(row.metricValues?.[0]?.value ?? 0), conversions: Number(row.metricValues?.[1]?.value ?? 0), leads: 0, breakdown: { sessions: Number(row.metricValues?.[0]?.value ?? 0) } }); count += 1;
    }
    return count;
  }

  private async upsertMetric(values: Partial<IntegrationMetric> & Pick<IntegrationMetric, 'provider' | 'externalAccountId' | 'clientId' | 'metricDate'>) {
    let metric = await this.metrics.findOne({ where: { organizationId: values.organizationId, provider: values.provider, externalAccountId: values.externalAccountId, clientId: values.clientId, metricDate: values.metricDate } });
    metric ??= this.metrics.create(values); Object.assign(metric, values); return this.metrics.save(metric);
  }

  private async getAccess(id: string, organizationId: string) {
    let integration = await this.getIntegration(id, organizationId);
    const expiry = typeof integration.config?.expiryDate === 'string' ? Date.parse(integration.config.expiryDate) : Number.NaN;
    if (Number.isFinite(expiry) && expiry <= Date.now() + 60_000) {
      integration = await this.oauth.refreshIntegration(id, organizationId);
    }
    const token = revealSecret(typeof integration?.config?.accessToken === 'string' ? integration.config.accessToken : undefined);
    if (!token) throw new BadRequestException('Google integration is not connected'); return { integration, token };
  }
  private async getIntegration(id: string, organizationId: string) {
    const integration = await this.integrations.findOne({ where: { id, organizationId, provider: IntegrationProvider.GOOGLE } });
    if (!integration) throw new BadRequestException('Google integration is not connected');
    return integration;
  }
  private adsApiVersion() { const version = process.env.GOOGLE_ADS_API_VERSION?.trim() || 'v24'; return /^v\d+$/.test(version) ? version : 'v24'; }
  private adsHeaders() { const developerToken = process.env.GOOGLE_DEVELOPER_TOKEN; if (!developerToken) throw new BadRequestException('GOOGLE_DEVELOPER_TOKEN is required'); return { 'developer-token': developerToken, ...(process.env.GOOGLE_LOGIN_CUSTOMER_ID ? { 'login-customer-id': process.env.GOOGLE_LOGIN_CUSTOMER_ID } : {}) }; }
  private async googleFetch<T>(url: string, token: string, init: RequestInit = {}): Promise<T> { const response = await fetch(url, { ...init, headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', ...(init.headers ?? {}) }, signal: AbortSignal.timeout(30000) }); const data = await response.json() as any; if (!response.ok) throw new BadRequestException(data?.error?.message ?? `Google request failed (${response.status})`); return data as T; }
}

interface GoogleAdsRow { segments: { date: string }; metrics: { costMicros?: string; impressions?: string; clicks?: string; conversions?: number } }
interface GaReport { rows?: Array<{ dimensionValues?: Array<{ value: string }>; metricValues?: Array<{ value: string }> }> }
