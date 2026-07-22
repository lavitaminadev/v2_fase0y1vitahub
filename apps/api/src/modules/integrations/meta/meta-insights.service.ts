import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IntegrationAccount } from '../integration-account.entity';
import { IntegrationAccountType } from '../integration-account-type.enum';
import { IntegrationMetric } from '../integration-metric.entity';
import { revealSecret } from '../../../shared/security/integration-secrets';

@Injectable()
export class MetaInsightsService {
  constructor(
    @InjectRepository(IntegrationAccount) private readonly accounts: Repository<IntegrationAccount>,
    @InjectRepository(IntegrationMetric) private readonly metrics: Repository<IntegrationMetric>,
  ) {}

  async sync(integrationId: string, organizationId: string) {
    const accounts = await this.accounts.find({ where: { integrationId, accountType: IntegrationAccountType.AD_ACCOUNT }, relations: { integration: true } });
    let synced = 0;
    const skipped: string[] = [];
    for (const account of accounts.filter((item) => item.metadata?.selected)) {
      if (account.integration.organizationId !== organizationId) continue;
      const clientId = typeof account.metadata?.clientId === 'string' ? account.metadata.clientId : undefined;
      if (!clientId) { skipped.push(account.externalName); continue; }
      const token = revealSecret(typeof account.integration.config?.accessToken === 'string' ? account.integration.config.accessToken : undefined);
      if (!token) throw new BadRequestException('Meta access token unavailable');
      const version = process.env.META_GRAPH_API_VERSION ?? 'v23.0';
      const params = new URLSearchParams({ fields: 'date_start,spend,impressions,reach,clicks,actions', date_preset: 'last_30d', time_increment: '1', limit: '100' });
      const response = await fetch(`https://graph.facebook.com/${version}/${account.externalId}/insights?${params}`, { headers: { authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(20000) });
      const payload = await response.json() as { data?: MetaInsight[]; error?: { message?: string } };
      if (!response.ok) throw new BadRequestException(payload.error?.message ?? 'Meta Insights sync failed');
      for (const row of payload.data ?? []) {
        const actions = Object.fromEntries((row.actions ?? []).map((action) => [action.action_type, Number(action.value)]));
        let metric = await this.metrics.findOne({ where: { provider: 'meta', externalAccountId: account.externalId, clientId, metricDate: new Date(row.date_start) } });
        metric ??= this.metrics.create({ organizationId, provider: 'meta', externalAccountId: account.externalId, clientId, metricDate: new Date(row.date_start) });
        Object.assign(metric, { spend: Number(row.spend ?? 0), impressions: Number(row.impressions ?? 0), reach: Number(row.reach ?? 0), clicks: Number(row.clicks ?? 0), leads: actions.lead ?? actions.onsite_conversion_lead_grouped ?? 0, conversions: actions.purchase ?? actions.offsite_conversion ?? 0, breakdown: { actions } });
        await this.metrics.save(metric); synced += 1;
      }
    }
    return { synced, skippedUnassignedAccounts: skipped };
  }
}

interface MetaInsight { date_start: string; spend?: string; impressions?: string; reach?: string; clicks?: string; actions?: Array<{ action_type: string; value: string }> }
