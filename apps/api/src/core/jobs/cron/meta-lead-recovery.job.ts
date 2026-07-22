import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MetaLeadAdsService } from '../../../modules/integrations/meta/meta-lead-ads.service';
import { IntegrationAccount } from '../../../modules/integrations/integration-account.entity';
import { IntegrationAccountType } from '../../../modules/integrations/integration-account-type.enum';
import { revealSecret } from '../../../shared/security/integration-secrets';

@Injectable()
export class MetaLeadRecoveryJob {
  private readonly logger = new Logger(MetaLeadRecoveryJob.name);

  constructor(
    @InjectRepository(IntegrationAccount) private readonly accountsRepo: Repository<IntegrationAccount>,
    private readonly metaLeadAdsService: MetaLeadAdsService,
  ) {}

  async handle(): Promise<void> {
    this.logger.log('Starting Meta Lead Recovery Job (Reconciliation)...');

    // Get all connected Meta Pages
    const pages = await this.accountsRepo.find({
      where: { accountType: IntegrationAccountType.PAGE },
      relations: ['integration'],
    });

    for (const page of pages) {
      if (!page.integration?.organizationId) continue;
      
      const accessToken = revealSecret(page.accessToken);
      if (!accessToken) {
        this.logger.warn(`Page ${page.externalId} has no access token. Skipping recovery.`);
        continue;
      }

      try {
        this.logger.log(`Fetching last leads for Page ${page.externalId}...`);
        
        // Fetch leads from Graph API created in the last 4 hours (or since last check)
        const version = process.env.META_GRAPH_API_VERSION ?? 'v23.0';
        const since = Math.floor(Date.now() / 1000) - (4 * 3600); // 4 hours ago

        const response = await fetch(`https://graph.facebook.com/${version}/${page.externalId}/leadgen_forms`, {
          headers: { authorization: `Bearer ${accessToken}` },
          signal: AbortSignal.timeout(20000),
        });
        
        if (!response.ok) {
          this.logger.error(`Failed to fetch forms for page ${page.externalId}`);
          continue;
        }

        const formsData = await response.json();
        for (const form of formsData.data || []) {
          // Fetch leads for this form
          const filtering = JSON.stringify([{ field: 'time_created', operator: 'GREATER_THAN', value: since }]);
          const leadsRes = await fetch(`https://graph.facebook.com/${version}/${form.id}/leads?filtering=${encodeURIComponent(filtering)}`, {
            headers: { authorization: `Bearer ${accessToken}` },
            signal: AbortSignal.timeout(20000),
          });
          if (!leadsRes.ok) continue;

          const leadsData = await leadsRes.json();
          for (const lead of leadsData.data || []) {
            // Re-inject the lead via the same webhook path to ensure deduplication rules apply safely
            // syncSingleLead simulates the webhook payload structure
            await this.metaLeadAdsService.syncSingleLead(page.externalId, lead.id);
          }
        }

      } catch (error) {
        this.logger.error(`Error recovering leads for Page ${page.externalId}:`, error);
      }
    }
    
    this.logger.log('Meta Lead Recovery Job completed.');
  }
}
