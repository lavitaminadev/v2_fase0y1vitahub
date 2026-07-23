import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MetaConversionOutboxService } from '../meta-conversion-outbox.service';
import { IntegrationAccount } from '../../integration-account.entity';
import { IntegrationAccountType } from '../../integration-account-type.enum';
import { Lead } from '../../../crm/leads/lead.entity';
import { Client } from '../../../clients/client.entity';

@Injectable()
export class LeadConvertedHandler {
  private readonly logger = new Logger(LeadConvertedHandler.name);

  constructor(
    private readonly outbox: MetaConversionOutboxService,
    @InjectRepository(IntegrationAccount) private readonly accountsRepo: Repository<IntegrationAccount>,
    @InjectRepository(Lead) private readonly leadRepo: Repository<Lead>,
    @InjectRepository(Client) private readonly clientRepo: Repository<Client>,
  ) {}

  @OnEvent('lead.converted')
  async handleLeadConvertedEvent(payload: { organizationId: string; leadId: string; clientId: string }) {
    try {
      const lead = await this.leadRepo.findOne({ where: { id: payload.leadId, organizationId: payload.organizationId } });
      if (!lead || !lead.email && !lead.phone) return;

      // Ensure the lead came from Meta originally
      if (lead.source !== 'meta_lead_ads' && !lead.metadata?.adId) return;

      const pageId = lead.metadata?.pageId;
      if (!pageId) return;

      const pageAccount = await this.accountsRepo.findOne({
        where: {
          accountType: IntegrationAccountType.PAGE,
          externalId: pageId,
          integration: { organizationId: lead.organizationId },
        },
        relations: { integration: true },
      });

      if (!pageAccount?.integration) return;

      const pixelId = typeof pageAccount.integration.config?.pixelId === 'string'
        ? pageAccount.integration.config.pixelId
        : undefined;
      if (!pixelId) return;

      const client = await this.clientRepo.findOne({ where: { id: payload.clientId, organizationId: lead.organizationId } });
      const eventId = `lead-converted:${lead.id}:${payload.clientId}`;
      await this.outbox.enqueue(lead.organizationId, pixelId, {
        eventName: 'QualifiedLead',
        eventTime: Math.floor(Date.now() / 1000),
        actionSource: 'system_generated',
        userData: {
          em: lead.email ? [lead.email] : undefined,
          ph: lead.phone ? [lead.phone] : undefined,
          externalId: [lead.id],
        },
        customData: {
          currency: 'CLP',
          value: client?.retainerAmount ? Number(client.retainerAmount) : undefined,
        },
        eventId,
      });
      this.logger.log(`CAPI event queued for Lead ${lead.id}`);
    } catch (error) {
      this.logger.error(`Error sending CAPI event for Lead ${payload.leadId}:`, error);
    }
  }
}
