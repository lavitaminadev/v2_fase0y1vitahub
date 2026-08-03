import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { LeadController } from '../../../src/modules/crm/leads/lead.controller';
import { UserRole } from '../../../src/modules/organizations/user-role.enum';

describe('LeadController', () => {
  let controller: LeadController;
  let createLead: any;
  let listLeads: any;
  let getLead: any;
  let convertLead: any;
  let updateLead: any;
  let reservationRepository: any;
  let accountAccess: any;

  beforeEach(() => {
    createLead = { execute: vi.fn() };
    listLeads = { execute: vi.fn() };
    getLead = { execute: vi.fn() };
    convertLead = { execute: vi.fn() };
    updateLead = { execute: vi.fn() };
    reservationRepository = { createQueryBuilder: vi.fn() };
    accountAccess = { allowedClientIds: vi.fn() };

    controller = new LeadController(
      createLead,
      listLeads,
      getLead,
      convertLead,
      updateLead,
      reservationRepository,
      accountAccess,
    );
  });

  it('lista leads con el scope de clientes permitido para La Vitamina', async () => {
    accountAccess.allowedClientIds.mockResolvedValue(['client-a', 'client-b']);
    listLeads.execute.mockResolvedValue({ data: [], total: 0, limit: 20, offset: 0 });

    const req = {
      organizationId: 'org-1',
      user: { id: 'cm-1', role: UserRole.COMMUNITY_MANAGER },
    } as any;

    await controller.list({ status: 'new', clientId: 'client-a', limit: 20, offset: 0 } as any, req);

    expect(listLeads.execute).toHaveBeenCalledWith('org-1', 20, 0, {
      status: 'new',
      fitStatus: undefined,
      source: undefined,
      clientId: 'client-a',
      allowedClientIds: ['client-a', 'client-b'],
    });
  });

  it('niega leer un lead fuera del alcance multi-cliente permitido', async () => {
    accountAccess.allowedClientIds.mockResolvedValue(['client-a']);
    getLead.execute.mockResolvedValue({ id: 'lead-1', clientId: 'client-b' });

    const req = {
      organizationId: 'org-1',
      user: { id: 'cm-1', role: UserRole.COMMUNITY_MANAGER },
    } as any;

    await expect(controller.getById('lead-1', req)).rejects.toBeInstanceOf(NotFoundException);
  });
});
