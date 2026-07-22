import { ConflictException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { ConvertLeadUseCase } from '../../../src/modules/crm/leads/use-cases/convert-lead.use-case';
import { LeadStatus } from '../../../src/modules/crm/leads/lead-status.enum';

describe('ConvertLeadUseCase', () => {
  it('emits the conversion event only after the transaction commits', async () => {
    let committed = false;
    const lead = { id: 'lead-1', name: 'Empresa', status: LeadStatus.NEW };
    const manager = {
      findOne: vi.fn().mockResolvedValue(lead),
      create: vi.fn((_entity, data) => data),
      save: vi.fn(async (_entity, data) => data.id ? data : { ...data, id: 'client-1' }),
    };
    const repo = {
      manager: {
        transaction: vi.fn(async (work) => {
          const result = await work(manager);
          committed = true;
          return result;
        }),
      },
    };
    const events = { emit: vi.fn(() => expect(committed).toBe(true)) };
    const useCase = new ConvertLeadUseCase(repo as never, {} as never, events as never);

    await useCase.execute('lead-1', 'org-1');

    expect(events.emit).toHaveBeenCalledWith('lead.converted', {
      organizationId: 'org-1',
      leadId: 'lead-1',
      clientId: 'client-1',
    });
  });

  it('rejects a second conversion of the same lead', async () => {
    const manager = {
      findOne: vi.fn().mockResolvedValue({ id: 'lead-1', status: LeadStatus.WON, convertedToClientId: 'client-1' }),
    };
    const repo = { manager: { transaction: vi.fn((work) => work(manager)) } };
    const useCase = new ConvertLeadUseCase(repo as never, {} as never, { emit: vi.fn() } as never);

    await expect(useCase.execute('lead-1', 'org-1')).rejects.toBeInstanceOf(ConflictException);
  });
});
