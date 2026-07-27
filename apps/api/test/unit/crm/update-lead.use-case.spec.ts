import { BadRequestException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { UpdateLeadUseCase } from '../../../src/modules/crm/leads/use-cases/update-lead.use-case';
import { LeadStatus } from '../../../src/modules/crm/leads/lead-status.enum';

describe('UpdateLeadUseCase', () => {
  it('requires client conversion before marking a lead as won', async () => {
    const repo = {
      findOne: vi.fn().mockResolvedValue({ id: 'lead-1', status: LeadStatus.NEGOTIATION }),
      save: vi.fn(),
    };
    const useCase = new UpdateLeadUseCase(repo as never);

    await expect(useCase.execute('lead-1', { status: LeadStatus.WON }, 'org-1')).rejects.toBeInstanceOf(BadRequestException);
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('allows a converted lead to remain in the won stage', async () => {
    const lead = { id: 'lead-1', status: LeadStatus.NEGOTIATION, convertedToClientId: 'client-1' };
    const repo = {
      findOne: vi.fn().mockResolvedValue(lead),
      save: vi.fn().mockImplementation(async (value) => value),
    };
    const useCase = new UpdateLeadUseCase(repo as never);

    const result = await useCase.execute('lead-1', { status: LeadStatus.WON }, 'org-1');

    expect(result.status).toBe(LeadStatus.WON);
    expect(repo.save).toHaveBeenCalledWith(lead);
  });
});
