import { beforeEach, describe, expect, it, vi } from 'vitest';
import { IntegrationAccountsService } from '../../../src/modules/integrations/integration-accounts.service';

describe('IntegrationAccountsService', () => {
  const accounts = { findOne: vi.fn(), save: vi.fn() };
  const clients = { findOne: vi.fn() };
  const service = new IntegrationAccountsService(accounts as any, clients as any);

  beforeEach(() => vi.clearAllMocks());

  it('selects an external account when it is assigned to a client', async () => {
    const account = { id: 'account-1', integration: { organizationId: 'org-1' }, metadata: { selected: false } };
    accounts.findOne.mockResolvedValue(account);
    clients.findOne.mockResolvedValue({ id: 'client-1', organizationId: 'org-1' });
    accounts.save.mockImplementation(async (value) => value);

    const result = await service.assignClient('account-1', 'client-1', 'org-1');

    expect(result.metadata).toEqual({ selected: true, clientId: 'client-1' });
    expect(clients.findOne).toHaveBeenCalledWith({ where: { id: 'client-1', organizationId: 'org-1' } });
  });

  it('deselects the account when its client is removed', async () => {
    const account = { id: 'account-1', integration: { organizationId: 'org-1' }, metadata: { selected: true, clientId: 'client-1' } };
    accounts.findOne.mockResolvedValue(account);
    accounts.save.mockImplementation(async (value) => value);

    const result = await service.assignClient('account-1', undefined, 'org-1');

    expect(result.metadata).toEqual({ selected: false });
  });
});
