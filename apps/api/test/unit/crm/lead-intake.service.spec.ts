import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LeadIntakeService } from '../../../src/modules/crm/leads/lead-intake.service';
import { LeadFitStatus } from '../../../src/modules/crm/leads/lead-fit-status.enum';

const repo = {
  create: vi.fn(),
  save: vi.fn(),
  findOne: vi.fn(),
};

const automation = {
  runForLead: vi.fn(),
};

describe('LeadIntakeService', () => {
  let service: LeadIntakeService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new LeadIntakeService(repo as any, automation as any);
    repo.create.mockImplementation((data) => data);
    repo.save.mockImplementation(async (data) => ({ id: data.id ?? 'lead-1', ...data }));
    automation.runForLead.mockResolvedValue(undefined);
  });

  it('qualifies a strong lead with contact data and campaign context', async () => {
    repo.findOne.mockResolvedValue(null);

    const lead = await service.captureLead({
      organizationId: 'org-1',
      name: 'Clínica Norte',
      email: 'gerencia@clinicanorte.cl',
      phone: '+56912345678',
      company: 'Clínica Norte',
      source: 'meta_lead_ads',
      campaignName: 'Campaña Marketing Reservas',
      notes: 'Quiere presupuesto para marketing y ads',
    });

    expect(lead.fitStatus).toBe(LeadFitStatus.QUALIFIED);
    expect(lead.qualityScore).toBeGreaterThanOrEqual(70);
    expect(automation.runForLead).toHaveBeenCalled();
  });

  it('discards a lead with no valid contact channel', async () => {
    repo.findOne.mockResolvedValue(null);

    const lead = await service.captureLead({
      organizationId: 'org-1',
      name: 'Sin contacto',
      source: 'meta_lead_ads',
      notes: 'Solo dejó una consulta genérica',
    });

    expect(lead.fitStatus).toBe(LeadFitStatus.DISCARDED);
    expect(lead.discardReason).toContain('email');
  });

  it('updates an existing lead when the external lead id already exists', async () => {
    repo.findOne
      .mockResolvedValueOnce({
        id: 'lead-existing',
        organizationId: 'org-1',
        metadata: {},
      });

    const lead = await service.captureLead({
      organizationId: 'org-1',
      name: 'Lead repetido',
      externalLeadId: 'meta-123',
      email: 'contacto@empresa.cl',
      phone: '+56900000000',
      source: 'meta_lead_ads',
    });

    expect(lead.id).toBe('lead-existing');
    expect(repo.save).toHaveBeenCalledWith(expect.objectContaining({ id: 'lead-existing' }));
  });
});
