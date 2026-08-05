import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MetaConversionOutboxService } from '../meta-conversion-outbox.service';
import { MetaClientPixelService } from '../meta-client-pixel.service';
import { IntegrationAccount } from '../../integration-account.entity';
import { IntegrationAccountType } from '../../integration-account-type.enum';
import { Lead } from '../../../crm/leads/lead.entity';
import { Client } from '../../../clients/client.entity';

@Injectable()
export class LeadConvertedHandler {
  private readonly logger = new Logger(LeadConvertedHandler.name);

  constructor(
    private readonly outbox: MetaConversionOutboxService,
    private readonly clientPixels: MetaClientPixelService,
    @InjectRepository(IntegrationAccount) private readonly accountsRepo: Repository<IntegrationAccount>,
    @InjectRepository(Lead) private readonly leadRepo: Repository<Lead>,
    @InjectRepository(Client) private readonly clientRepo: Repository<Client>,
  ) {}

  @OnEvent('lead.converted')
  async handleLeadConvertedEvent(payload: { organizationId: string; leadId: string; clientId: string }) {
    try {
      const lead = await this.leadRepo.findOne({ where: { id: payload.leadId, organizationId: payload.organizationId } });
      if (!lead || !lead.email && !lead.phone) return;

      // Verifica que el lead haya venido originalmente de Meta
      if (lead.source !== 'meta_lead_ads' && !lead.metadata?.adId) return;

      // `pageId` es columna propia del lead (ver LeadIntakeService/MetaLeadAdsService), no viaja
      // dentro de `metadata`: ahi solo se guardan adId/adsetId/formId/etc.
      const pageId = lead.pageId;
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

      // El Pixel se resuelve por cliente, igual que en el camino de reservas. Antes se leía
      // `config.pixelId`, que es un único valor de la organización: en una agencia con varias
      // cuentas eso mandaba la conversión de un cliente al Pixel del último que se validó,
      // junto con el importe de su retainer.
      const { pixelId } = await this.clientPixels.resolve(lead.organizationId, payload.clientId);
      if (!pixelId) {
        this.logger.warn(`Lead ${lead.id}: el cliente ${payload.clientId} no tiene Pixel configurado; no se encola la conversión`);
        return;
      }

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
