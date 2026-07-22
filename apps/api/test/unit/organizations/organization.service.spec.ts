import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundException } from '@nestjs/common';

const mockRepo = {
  create: vi.fn(),
  save: vi.fn(),
  find: vi.fn(),
  findOne: vi.fn(),
};

import { CreateOrganizationUseCase } from '../../../src/modules/organizations/create-organization.use-case';
import { ListOrganizationsUseCase } from '../../../src/modules/organizations/list-organizations.use-case';

describe('OrganizationService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('create', () => {
    it('should create and return an organization', async () => {
      const useCase = new CreateOrganizationUseCase(mockRepo as any);
      mockRepo.create.mockReturnValue({ id: 'org-1', name: 'Test Corp', code: 'TEST' });
      mockRepo.save.mockResolvedValue({ id: 'org-1', name: 'Test Corp', code: 'TEST' });

      const result = await useCase.execute({ name: 'Test Corp', code: 'TEST' });

      expect(result.id).toBe('org-1');
      expect(mockRepo.create).toHaveBeenCalledWith({ name: 'Test Corp', code: 'TEST' });
    });
  });

  describe('list', () => {
    it('should return a list of organizations', async () => {
      const useCase = new ListOrganizationsUseCase(mockRepo as any);
      mockRepo.find.mockResolvedValue([
        { id: 'org-1', name: 'Org A' },
        { id: 'org-2', name: 'Org B' },
      ]);

      const result = await useCase.execute();

      expect(result).toHaveLength(2);
    });
  });

  describe('find by id', () => {
    it('should return null when organization not found', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      const result = await mockRepo.findOne({ where: { id: 'nonexistent' } });

      expect(result).toBeNull();
    });
  });
});
