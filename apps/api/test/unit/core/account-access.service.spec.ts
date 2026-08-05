import { NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AccountAccessService } from '../../../src/core/client-scope/account-access.service';
import { UserRole } from '../../../src/modules/organizations/user-role.enum';

const ORG = 'org-1';

function userWith(role: UserRole, overrides: Record<string, unknown> = {}) {
  return {
    id: 'user-1',
    email: 'persona@vitahub.cl',
    name: 'Persona',
    role,
    organizationId: ORG,
    tenantId: ORG,
    ...overrides,
  } as any;
}

describe('AccountAccessService', () => {
  let clients: { find: ReturnType<typeof vi.fn>; findOne: ReturnType<typeof vi.fn> };
  let podMembers: { find: ReturnType<typeof vi.fn> };
  let assignments: { find: ReturnType<typeof vi.fn> };
  let service: AccountAccessService;

  beforeEach(() => {
    clients = { find: vi.fn().mockResolvedValue([]), findOne: vi.fn() };
    podMembers = { find: vi.fn().mockResolvedValue([]) };
    assignments = { find: vi.fn().mockResolvedValue([]) };
    service = new AccountAccessService(clients as any, podMembers as any, assignments as any);
  });

  it('la administración no tiene límite de cuentas', async () => {
    await expect(service.allowedClientIds(ORG, userWith(UserRole.ADMIN))).resolves.toBeUndefined();
  });

  it('un cliente solo ve su propia cuenta', async () => {
    const scope = await service.allowedClientIds(ORG, userWith(UserRole.CLIENT, { clientId: 'cli-9' }));
    expect(scope).toEqual(['cli-9']);
  });

  it('un cliente sin cuenta asociada no ve ninguna', async () => {
    await expect(service.allowedClientIds(ORG, userWith(UserRole.CLIENT))).resolves.toEqual([]);
  });

  it('las direcciones quedan acotadas, no ven todas las cuentas', async () => {
    // Es el cambio de comportamiento: antes cualquier cargo distinto de community manager y
    // cliente recibia `undefined`, que significa "sin limite".
    const scope = await service.allowedClientIds(ORG, userWith(UserRole.OPERATIONS_DIRECTOR));
    expect(scope).toEqual([]);
  });

  it('hereda del pod las cuentas asignadas al pod', async () => {
    podMembers.find.mockResolvedValue([{ podId: 'pod-1' }]);
    clients.find.mockImplementation(async ({ where }: any) =>
      where.podId ? [{ id: 'cli-1' }, { id: 'cli-2' }] : []);

    const scope = await service.allowedClientIds(ORG, userWith(UserRole.DESIGNER));

    expect(scope).toEqual(['cli-1', 'cli-2']);
  });

  it('suma las asignaciones directas a lo que da el pod', async () => {
    podMembers.find.mockResolvedValue([{ podId: 'pod-1' }]);
    clients.find.mockImplementation(async ({ where }: any) => (where.podId ? [{ id: 'cli-1' }] : []));
    assignments.find.mockResolvedValue([{ clientId: 'cli-7' }]);

    const scope = await service.allowedClientIds(ORG, userWith(UserRole.AUDIOVISUAL));

    expect(scope).toEqual(['cli-1', 'cli-7']);
  });

  it('conserva el acceso del community manager por la cuenta que tiene a cargo', async () => {
    clients.find.mockImplementation(async ({ where }: any) =>
      (where.communityManagerId ? [{ id: 'cli-3' }] : []));

    const scope = await service.allowedClientIds(ORG, userWith(UserRole.COMMUNITY_MANAGER));

    expect(scope).toEqual(['cli-3']);
  });

  it('no repite una cuenta que llega por dos vías', async () => {
    podMembers.find.mockResolvedValue([{ podId: 'pod-1' }]);
    clients.find.mockImplementation(async ({ where }: any) =>
      (where.podId ? [{ id: 'cli-1' }] : where.communityManagerId ? [{ id: 'cli-1' }] : []));

    const scope = await service.allowedClientIds(ORG, userWith(UserRole.COMMUNITY_MANAGER));

    expect(scope).toEqual(['cli-1']);
  });

  it('explica la procedencia de cada cuenta visible', async () => {
    podMembers.find.mockResolvedValue([{ podId: 'pod-1' }]);
    clients.find.mockImplementation(async ({ where }: any) => (where.podId ? [{ id: 'cli-1' }] : []));
    assignments.find.mockResolvedValue([{ clientId: 'cli-7' }]);

    const reasons = await service.explain(ORG, userWith(UserRole.DESIGNER));

    expect(reasons).toEqual([
      { clientId: 'cli-1', source: 'pod' },
      { clientId: 'cli-7', source: 'assignment' },
    ]);
  });

  describe('assertClient', () => {
    it('deja pasar una cuenta dentro del alcance', async () => {
      clients.findOne.mockResolvedValue({ id: 'cli-1' });
      podMembers.find.mockResolvedValue([{ podId: 'pod-1' }]);
      clients.find.mockImplementation(async ({ where }: any) => (where.podId ? [{ id: 'cli-1' }] : []));

      await expect(service.assertClient(ORG, userWith(UserRole.DESIGNER), 'cli-1')).resolves.toBeUndefined();
    });

    it('responde "no encontrada" ante una cuenta fuera del alcance', async () => {
      // 404 y no 403: confirmar que la cuenta existe pero esta vedada ya revela la cartera
      // de clientes de la agencia.
      clients.findOne.mockResolvedValue({ id: 'cli-9' });

      await expect(service.assertClient(ORG, userWith(UserRole.DESIGNER), 'cli-9'))
        .rejects.toThrow(NotFoundException);
    });

    it('no comprueba nada cuando no se indica cuenta', async () => {
      await expect(service.assertClient(ORG, userWith(UserRole.DESIGNER))).resolves.toBeUndefined();
      expect(clients.findOne).not.toHaveBeenCalled();
    });
  });

  it('descarta lo memorizado de una persona tras cambiar su alcance', async () => {
    podMembers.find.mockResolvedValue([]);
    const user = userWith(UserRole.DESIGNER);

    await service.allowedClientIds(ORG, user);
    await service.allowedClientIds(ORG, user);
    expect(podMembers.find).toHaveBeenCalledTimes(1);

    service.invalidateUser(user.id);
    await service.allowedClientIds(ORG, user);
    expect(podMembers.find).toHaveBeenCalledTimes(2);
  });
});
