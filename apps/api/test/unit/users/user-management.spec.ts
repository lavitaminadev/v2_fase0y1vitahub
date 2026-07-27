import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { CreateUserUseCase } from '../../../src/modules/users/create-user.use-case';
import { UpdateUserUseCase } from '../../../src/modules/users/update-user.use-case';
import { UserRole } from '../../../src/modules/organizations/user-role.enum';

const usersRepo = {
  findOne: vi.fn(),
  create: vi.fn(),
  save: vi.fn(),
};

const clientsRepo = { findOne: vi.fn() };

describe('User management security', () => {
  beforeEach(() => vi.clearAllMocks());

  it('rejects duplicate normalized emails', async () => {
    const useCase = new CreateUserUseCase(usersRepo as never, clientsRepo as never);
    usersRepo.findOne.mockResolvedValue({ id: 'existing' });

    await expect(useCase.execute({
      organizationId: 'org-1', actorRole: UserRole.ADMIN, role: UserRole.DESIGNER,
      name: 'Nueva Persona', email: ' PERSONA@EMPRESA.CL ', password: 'secure123',
    })).rejects.toThrow(ConflictException);
    expect(usersRepo.findOne).toHaveBeenCalledWith({ where: { email: 'persona@empresa.cl' } });
  });

  it('requires a valid organization client for portal accounts', async () => {
    const useCase = new CreateUserUseCase(usersRepo as never, clientsRepo as never);
    usersRepo.findOne.mockResolvedValue(null);

    await expect(useCase.execute({
      organizationId: 'org-1', actorRole: UserRole.ADMIN, role: UserRole.CLIENT,
      name: 'Cliente Portal', email: 'cliente@empresa.cl', password: 'secure123',
    })).rejects.toThrow(BadRequestException);
  });

  it('prevents operations directors from escalating privileges', async () => {
    const useCase = new CreateUserUseCase(usersRepo as never, clientsRepo as never);

    await expect(useCase.execute({
      organizationId: 'org-1', actorRole: UserRole.OPERATIONS_DIRECTOR, role: UserRole.ADMIN,
      name: 'Admin Nuevo', email: 'admin@empresa.cl', password: 'secure123',
    })).rejects.toThrow(ForbiddenException);
  });

  it('prevents administrators from disabling their own account', async () => {
    const useCase = new UpdateUserUseCase(usersRepo as never, clientsRepo as never);
    usersRepo.findOne.mockResolvedValue({ id: 'user-1', organizationId: 'org-1', role: UserRole.ADMIN, isActive: true });

    await expect(useCase.execute({
      id: 'user-1', organizationId: 'org-1', actorId: 'user-1', actorRole: UserRole.ADMIN, isActive: false,
    })).rejects.toThrow(BadRequestException);
  });
});
