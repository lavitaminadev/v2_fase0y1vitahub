import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { IntegrationAccount } from '../integration-account.entity';
import { IntegrationAccountType } from '../integration-account-type.enum';
import { LeadIntakeService } from '../../crm/leads/lead-intake.service';
import { MetaLeadWebhookEvent } from './meta-lead-webhook-event.entity';
import { revealSecret } from '../../../shared/security/integration-secrets';

interface MetaLeadgenPayload {
  object?: string;
  entry?: Array<{
    id: string;
    changes?: Array<{
      field?: string;
      value?: {
        page_id?: string;
        form_id?: string;
        leadgen_id?: string;
        created_time?: number;
      };
    }>;
  }>;
}

interface MetaLeadField {
  name: string;
  values?: string[];
}

interface MetaLeadDetailResponse {
  id: string;
  created_time?: string;
  ad_id?: string;
  ad_name?: string;
  adset_id?: string;
  adset_name?: string;
  campaign_id?: string;
  campaign_name?: string;
  form_id?: string;
  field_data?: MetaLeadField[];
  custom_disclaimer_responses?: unknown[];
  platform?: string;
}

@Injectable()
export class MetaLeadAdsService {
  private readonly logger = new Logger(MetaLeadAdsService.name);

  constructor(
    @InjectRepository(IntegrationAccount) private readonly accountsRepo: Repository<IntegrationAccount>,
    @InjectRepository(MetaLeadWebhookEvent) private readonly eventsRepo: Repository<MetaLeadWebhookEvent>,
    private readonly leadIntake: LeadIntakeService,
  ) {}

  async processWebhook(
    payload: MetaLeadgenPayload,
    options?: { organizationId?: string },
  ): Promise<{ accepted: number; createdOrUpdated: number }> {
    const changes = this.extractLeadgenChanges(payload);
    let createdOrUpdated = 0;

    // Batch load: get all unique pageIds
    const pageIds = [...new Set(changes.map(c => c.pageId))];
    const pageAccountsMap = new Map<string, IntegrationAccount[]>();
    if (pageIds.length > 0) {
      const accounts = await this.accountsRepo.find({
        where: { externalId: In(pageIds), accountType: IntegrationAccountType.PAGE },
        relations: { integration: true },
      });
      pageIds.forEach(pageId => {
        pageAccountsMap.set(pageId, accounts.filter(a => a.externalId === pageId));
      });
    }

    // Batch load: get existing events
    const existingEvents = await this.eventsRepo.find({
      where: changes.map(c => ({ pageId: c.pageId, leadgenId: c.leadgenId })),
    });
    const eventMap = new Map(existingEvents.map(e => [`${e.pageId}-${e.leadgenId}`, e]));

    for (const change of changes) {
      const existingEvent = eventMap.get(`${change.pageId}-${change.leadgenId}`);
      if (existingEvent?.processingStatus === 'processed') {
        continue;
      }

      const event = existingEvent ?? this.eventsRepo.create({
        pageId: change.pageId,
        leadgenId: change.leadgenId,
        formId: change.formId,
        rawPayload: change.rawPayload,
        processingStatus: 'received',
      });

      try {
        const pageAccounts = pageAccountsMap.get(change.pageId) ?? [];
        const selectedAccounts = pageAccounts.filter((account) =>
          Boolean(account.metadata?.selected) &&
          (!options?.organizationId || account.integration?.organizationId === options.organizationId),
        );
        const selectedOrganizations = new Set(selectedAccounts.map((account) => account.integration?.organizationId).filter(Boolean));
        if (selectedOrganizations.size > 1) {
          event.processingStatus = 'error';
          event.errorMessage = 'La pagina Meta esta seleccionada en mas de una organizacion; corrige la asignacion antes de procesar leads.';
          await this.eventsRepo.save(event);
          continue;
        }
        const pageAccount = selectedAccounts[0] ?? pageAccounts.find((account) =>
          !options?.organizationId || account.integration?.organizationId === options.organizationId,
        );

        if (!pageAccount?.integration?.organizationId) {
          event.processingStatus = 'ignored';
          event.errorMessage = 'No existe una página Meta seleccionada para este webhook.';
          await this.eventsRepo.save(event);
          continue;
        }

        if (options?.organizationId && pageAccount.integration.organizationId !== options.organizationId) {
          event.processingStatus = 'ignored';
          event.errorMessage = 'La pagina Meta no pertenece a la organizacion autenticada.';
          await this.eventsRepo.save(event);
          continue;
        }

        if (!pageAccount.metadata?.selected) {
          event.organizationId = pageAccount.integration.organizationId;
          event.processingStatus = 'ignored';
          event.errorMessage = 'La pagina Meta existe pero no esta seleccionada para capturar leads.';
          await this.eventsRepo.save(event);
          continue;
        }

        const accessToken = revealSecret(pageAccount.accessToken);
        if (!accessToken) {
          event.processingStatus = 'error';
          event.errorMessage = 'La página Meta no tiene access token para descargar el lead.';
          await this.eventsRepo.save(event);
          continue;
        }

        const leadDetail = await this.retrieveLead(change.leadgenId, accessToken);
        const normalized = this.normalizeLeadDetail(leadDetail);
        await this.leadIntake.captureLead({
          organizationId: pageAccount.integration.organizationId,
          name: normalized.name,
          email: normalized.email,
          phone: normalized.phone,
          company: normalized.company,
          source: 'meta_lead_ads',
          sourceDetail: normalized.sourceDetail,
          notes: normalized.notes,
          externalLeadId: leadDetail.id,
          externalFormId: leadDetail.form_id ?? change.formId,
          externalCampaignId: leadDetail.campaign_id,
          campaignName: leadDetail.campaign_name,
          pageId: change.pageId,
          consentCapturedAt: leadDetail.created_time ? new Date(leadDetail.created_time) : undefined,
          metadata: {
            adId: leadDetail.ad_id,
            adName: leadDetail.ad_name,
            adsetId: leadDetail.adset_id,
            adsetName: leadDetail.adset_name,
            formId: leadDetail.form_id ?? change.formId,
            platform: leadDetail.platform,
            fieldData: (leadDetail.field_data ?? []) as unknown as Record<string, unknown>[],
            customDisclaimerResponses: (leadDetail.custom_disclaimer_responses ?? []) as unknown as Record<string, unknown>[],
          },
        });

        event.organizationId = pageAccount.integration.organizationId;
        event.processingStatus = 'processed';
        event.normalizedPayload = {
          leadgenId: leadDetail.id,
          campaignName: leadDetail.campaign_name,
          formId: leadDetail.form_id ?? change.formId,
          pageId: change.pageId,
          fieldNames: (leadDetail.field_data ?? []).map((field) => field.name),
        };
        event.processedAt = new Date();
        await this.eventsRepo.save(event);
        createdOrUpdated += 1;
      } catch (error) {
        event.processingStatus = 'error';
        event.errorMessage = error instanceof Error ? error.message : 'Error desconocido procesando lead de Meta.';
        await this.eventsRepo.save(event);
        this.logger.error(event.errorMessage);
      }
    }

    return { accepted: changes.length, createdOrUpdated };
  }

  async syncSingleLead(
    pageId: string,
    leadgenId: string,
    organizationId?: string,
  ): Promise<{ accepted: number; createdOrUpdated: number }> {
    return this.processWebhook({
      object: 'page',
      entry: [{ id: pageId, changes: [{ field: 'leadgen', value: { page_id: pageId, leadgen_id: leadgenId } }] }],
    }, { organizationId });
  }

  private extractLeadgenChanges(payload: MetaLeadgenPayload) {
    const changes: Array<{ pageId: string; formId?: string; leadgenId: string; rawPayload: Record<string, any> }> = [];

    for (const entry of payload.entry ?? []) {
      for (const change of entry.changes ?? []) {
        if (change.field !== 'leadgen' || !change.value?.leadgen_id) continue;
        changes.push({
          pageId: change.value.page_id ?? entry.id,
          formId: change.value.form_id,
          leadgenId: change.value.leadgen_id,
          rawPayload: { entryId: entry.id, change },
        });
      }
    }

    return changes;
  }

  private async retrieveLead(leadgenId: string, accessToken: string): Promise<MetaLeadDetailResponse> {
    const version = process.env.META_GRAPH_API_VERSION ?? 'v23.0';
    const params = new URLSearchParams({
      fields: [
        'id',
        'created_time',
        'ad_id',
        'ad_name',
        'adset_id',
        'adset_name',
        'campaign_id',
        'campaign_name',
        'form_id',
        'field_data',
        'custom_disclaimer_responses',
        'platform',
      ].join(','),
    });

    const response = await fetch(`https://graph.facebook.com/${version}/${leadgenId}?${params.toString()}`, {
      headers: { authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(15000),
    });
    const data = await response.json() as MetaLeadDetailResponse | { error?: { message?: string } };

    if (!response.ok) {
      throw new BadRequestException(
        typeof data === 'object' && data && 'error' in data && data.error?.message
          ? data.error.message
          : 'Meta no devolvió el detalle del lead.',
      );
    }

    return data as MetaLeadDetailResponse;
  }

  private normalizeLeadDetail(lead: MetaLeadDetailResponse) {
    const fields = new Map<string, string>();
    for (const field of lead.field_data ?? []) {
      const value = field.values?.filter(Boolean).join(', ').trim();
      if (value) fields.set(field.name.toLowerCase(), value);
    }

    const fullName =
      fields.get('full_name') ||
      fields.get('name') ||
      [fields.get('first_name'), fields.get('last_name')].filter(Boolean).join(' ').trim() ||
      'Lead Meta';

    const company = fields.get('company_name') || fields.get('company') || fields.get('negocio');
    const notes = Array.from(fields.entries())
      .filter(([name]) => !['full_name', 'name', 'first_name', 'last_name', 'email', 'phone_number', 'phone', 'company_name', 'company', 'negocio'].includes(name))
      .map(([name, value]) => `${name}: ${value}`)
      .join('\n');

    return {
      name: fullName,
      email: fields.get('email'),
      phone: fields.get('phone_number') || fields.get('phone') || fields.get('telefono') || fields.get('teléfono'),
      company,
      sourceDetail: [lead.campaign_name, lead.ad_name, fields.get('service')].filter(Boolean).join(' · '),
      notes: notes || undefined,
    };
  }
}
