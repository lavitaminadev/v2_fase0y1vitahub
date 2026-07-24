import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { IntegrationAccount } from '../integration-account.entity';
import { IntegrationAccountType } from '../integration-account-type.enum';
import { IntegrationMetric } from '../integration-metric.entity';
import { revealSecret } from '../../../shared/security/integration-secrets';

@Injectable()
export class MetaInsightsService {
  private readonly logger = new Logger(MetaInsightsService.name);

  constructor(
    @InjectRepository(IntegrationAccount) private readonly accounts: Repository<IntegrationAccount>,
    @InjectRepository(IntegrationMetric) private readonly metrics: Repository<IntegrationMetric>,
  ) {}

  async sync(integrationId: string, organizationId: string) {
    const accounts = await this.accounts.find({ where: { integrationId, accountType: IntegrationAccountType.AD_ACCOUNT }, relations: { integration: true } });
    let synced = 0;
    const skipped: string[] = [];
    const failed: string[] = [];
    for (const account of accounts.filter((item) => item.metadata?.selected)) {
      if (account.integration.organizationId !== organizationId) continue;
      const clientId = typeof account.metadata?.clientId === 'string' ? account.metadata.clientId : undefined;
      if (!clientId) { skipped.push(account.externalName); continue; }
      try {
        const token = revealSecret(typeof account.integration.config?.accessToken === 'string' ? account.integration.config.accessToken : undefined);
        if (!token) throw new BadRequestException('Meta access token unavailable');
        const version = process.env.META_GRAPH_API_VERSION ?? 'v23.0';
        const params = new URLSearchParams({ fields: 'date_start,spend,impressions,reach,clicks,actions', date_preset: 'last_30d', time_increment: '1', limit: '100' });
        const response = await fetch(`https://graph.facebook.com/${version}/${account.externalId}/insights?${params}`, { headers: { authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(20000) });
        const payload = await response.json() as { data?: MetaInsight[]; error?: { message?: string } };
        if (!response.ok) throw new BadRequestException(payload.error?.message ?? 'Meta Insights sync failed');
        const metricsToUpsert = (payload.data ?? []).map((row) => {
          const actions = Object.fromEntries((row.actions ?? []).map((action) => [action.action_type, Number(action.value)]));
          return {
            organizationId,
            provider: 'meta' as const,
            externalAccountId: account.externalId,
            clientId,
            metricDate: new Date(row.date_start),
            spend: Number(row.spend ?? 0),
            impressions: Number(row.impressions ?? 0),
            reach: Number(row.reach ?? 0),
            clicks: Number(row.clicks ?? 0),
            leads: actions.lead ?? actions.onsite_conversion_lead_grouped ?? 0,
            conversions: actions.purchase ?? actions.offsite_conversion ?? 0,
            breakdown: { actions } as Record<string, unknown>,
          };
        });
        if (metricsToUpsert.length > 0) {
          // TypeORM's DeepPartial can't reconcile a `Record<string, any>` json column through upsert(); the shape above is correct at runtime.
          await this.metrics.upsert(metricsToUpsert as QueryDeepPartialEntity<IntegrationMetric>[], ['provider', 'externalAccountId', 'clientId', 'metricDate']);
          synced += metricsToUpsert.length;
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        this.logger.warn(`Meta insights sync failed for account ${account.externalId} (${account.externalName}): ${message}`);
        failed.push(account.externalName);
      }
    }
    return { synced, skippedUnassignedAccounts: skipped, failedAccounts: failed };
  }
}

interface MetaInsight { date_start: string; spend?: string; impressions?: string; reach?: string; clicks?: string; actions?: Array<{ action_type: string; value: string }> }
