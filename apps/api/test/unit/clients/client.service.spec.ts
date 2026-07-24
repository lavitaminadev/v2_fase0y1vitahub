import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundException } from '@nestjs/common';

const mockRepo = {
  create: vi.fn(),
  save: vi.fn(),
  find: vi.fn(),
  findOne: vi.fn(),
  findAndCount: vi.fn(),
};

import { CreateClientUseCase } from '../../../src/modules/clients/create-client.use-case';
import { ListClientsUseCase } from '../../../src/modules/clients/list-clients.use-case';
import { GetClientUseCase } from '../../../src/modules/clients/get-client.use-case';
import { ClientStatus } from '../../../src/modules/clients/client-status.enum';

describe('ClientService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createClient', () => {
    it('should create a client with the given data', async () => {
      const useCase = new CreateClientUseCase(mockRepo as any);
      mockRepo.create.mockReturnValue({ id: 'client-1', name: 'Acme Corp', organizationId: 'org-1' });
      mockRepo.save.mockResolvedValue({ id: 'client-1', name: 'Acme Corp', organizationId: 'org-1' });

      const result = await useCase.execute({ organizationId: 'org-1', name: 'Acme Corp' });

      expect(result.id).toBe('client-1');
      expect(mockRepo.create).toHaveBeenCalledWith({
        organizationId: 'org-1',
        name: 'Acme Corp',
        capabilities: { reservations: true, crm: true, metaConversions: false },
      });
    });
  });

  describe('listClients', () => {
    it('should list clients filtered by organization', async () => {
      const useCase = new ListClientsUseCase(mockRepo as any);
      mockRepo.findAndCount.mockResolvedValue([
        [
          { id: 'c1', name: 'Client A', organizationId: 'org-1' },
          { id: 'c2', name: 'Client B', organizationId: 'org-1' },
        ],
        2,
      ]);

      const result = await useCase.execute('org-1');

      expect(result.data).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(mockRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ where: { organizationId: 'org-1' } }),
      );
    });
  });

  describe('getClient', () => {
    it('should throw NotFoundException when client not found', async () => {
      const useCase = new GetClientUseCase(mockRepo as any);
      mockRepo.findOne.mockResolvedValue(null);

      await expect(useCase.execute('nonexistent', 'org-1')).rejects.toThrow(NotFoundException);
    });
  });
});
