import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MetaLeadAdsService } from '../../../src/modules/integrations/meta/meta-lead-ads.service';

const accountsRepo = {
  find: vi.fn(),
};

const eventsRepo = {
  findOne: vi.fn(),
  create: vi.fn(),
  save: vi.fn(),
};

const leadIntake = {
  captureLead: vi.fn(),
};

describe('MetaLeadAdsService', () => {
  let service: MetaLeadAdsService;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    service = new MetaLeadAdsService(accountsRepo as any, eventsRepo as any, leadIntake as any);
    eventsRepo.create.mockImplementation((data) => data);
    eventsRepo.findOne.mockResolvedValue(null);
    eventsRepo.save.mockImplementation(async (data) => ({ id: 'evt-1', ...data }));
    leadIntake.captureLead.mockResolvedValue({ id: 'lead-1' });
    process.env.META_GRAPH_API_VERSION = 'v23.0';
  });

  it('downloads the lead and sends normalized data to the CRM intake service', async () => {
    accountsRepo.find.mockResolvedValue([{
      externalId: 'page-1',
      accessToken: 'page-token',
      metadata: { selected: true },
      integration: { organizationId: 'org-1' },
    }]);

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          id: 'leadgen-1',
          campaign_id: 'cmp-1',
          campaign_name: 'Campaña Reservas',
          form_id: 'form-1',
          ad_name: 'Anuncio Reserva',
          field_data: [
            { name: 'full_name', values: ['María Pérez'] },
            { name: 'email', values: ['maria@empresa.cl'] },
            { name: 'phone_number', values: ['+56911111111'] },
            { name: 'company_name', values: ['Empresa Spa'] },
            { name: 'service', values: ['Marketing para reservas'] },
          ],
        }),
      }),
    );

    const result = await service.processWebhook({
      object: 'page',
      entry: [
        {
          id: 'page-1',
          changes: [{ field: 'leadgen', value: { page_id: 'page-1', form_id: 'form-1', leadgen_id: 'leadgen-1' } }],
        },
      ],
    });

    expect(result.accepted).toBe(1);
    expect(result.createdOrUpdated).toBe(1);
    expect(leadIntake.captureLead).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 'org-1',
        source: 'meta_lead_ads',
        externalLeadId: 'leadgen-1',
        externalFormId: 'form-1',
        campaignName: 'Campaña Reservas',
        email: 'maria@empresa.cl',
      }),
    );
  });

  it('ignores webhook events for pages that are not selected for lead capture', async () => {
    accountsRepo.find.mockResolvedValue([{
      externalId: 'page-1',
      accessToken: 'page-token',
      metadata: { selected: false },
      integration: { organizationId: 'org-1' },
    }]);

    const result = await service.processWebhook({
      object: 'page',
      entry: [
        {
          id: 'page-1',
          changes: [{ field: 'leadgen', value: { page_id: 'page-1', leadgen_id: 'leadgen-1' } }],
        },
      ],
    });

    expect(result.accepted).toBe(1);
    expect(result.createdOrUpdated).toBe(0);
    expect(leadIntake.captureLead).not.toHaveBeenCalled();
  });

  it('ignores manual sync when the page belongs to another organization', async () => {
    accountsRepo.find.mockResolvedValue([{
      externalId: 'page-1',
      accessToken: 'page-token',
      metadata: { selected: true },
      integration: { organizationId: 'org-2' },
    }]);

    const result = await service.syncSingleLead('page-1', 'leadgen-1', 'org-1');

    expect(result.accepted).toBe(1);
    expect(result.createdOrUpdated).toBe(0);
    expect(leadIntake.captureLead).not.toHaveBeenCalled();
  });

  it('does not process an already completed webhook event twice', async () => {
    eventsRepo.findOne.mockResolvedValue({
      id: 'evt-existing',
      pageId: 'page-1',
      leadgenId: 'leadgen-1',
      processingStatus: 'processed',
    });

    const result = await service.syncSingleLead('page-1', 'leadgen-1', 'org-1');

    expect(result).toEqual({ accepted: 1, createdOrUpdated: 0 });
    expect(accountsRepo.find).not.toHaveBeenCalled();
    expect(leadIntake.captureLead).not.toHaveBeenCalled();
  });
});
