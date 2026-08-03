import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ForbiddenException } from '@nestjs/common';
import { ReservationsController } from '../../../src/modules/reservations/reservations.controller';
import { UserRole } from '../../../src/modules/organizations/user-role.enum';

describe('ReservationsController', () => {
  let controller: ReservationsController;
  let service: any;
  let accountAccess: any;
  let bulkImport: any;

  beforeEach(() => {
    service = {
      listReservations: vi.fn(),
      updateReservation: vi.fn(),
    };
    accountAccess = {
      allowedClientIds: vi.fn(),
      assertClient: vi.fn(),
    };
    bulkImport = {
      parse: vi.fn(),
      import: vi.fn(),
    };
    controller = new ReservationsController(service, accountAccess, bulkImport);
  });

  it('acota el listado del portal cliente a su propio clientId', async () => {
    accountAccess.allowedClientIds.mockResolvedValue(['client-portal']);
    service.listReservations.mockResolvedValue({ items: [], total: 0 });

    const req = {
      organizationId: 'org-1',
      user: { id: 'user-1', role: UserRole.CLIENT, clientId: 'client-portal' },
    } as any;

    await controller.list(req, {} as any);

    expect(service.listReservations).toHaveBeenCalledWith(
      'org-1',
      {},
      'client-portal',
      ['client-portal'],
      false,
    );
  });

  it('valida requestedClientId para usuarios internos antes de listar', async () => {
    accountAccess.allowedClientIds.mockResolvedValue(['client-a', 'client-b']);
    accountAccess.assertClient.mockResolvedValue(undefined);
    service.listReservations.mockResolvedValue({ items: [], total: 0 });

    const req = {
      organizationId: 'org-1',
      user: { id: 'cm-1', role: UserRole.COMMUNITY_MANAGER },
    } as any;

    await controller.list(req, { clientId: 'client-a' } as any);

    expect(accountAccess.assertClient).toHaveBeenCalledWith('org-1', req.user, 'client-a');
    expect(service.listReservations).toHaveBeenCalledWith('org-1', { clientId: 'client-a' }, 'client-a', undefined, true);
  });

  it('rechaza cambios de cliente fuera de cancelar su propia reserva', async () => {
    accountAccess.allowedClientIds.mockResolvedValue(['client-portal']);

    const req = {
      organizationId: 'org-1',
      user: { id: 'user-1', role: UserRole.CLIENT, clientId: 'client-portal' },
    } as any;

    await expect(
      controller.updateReservation(req, 'res-1', { internalNotes: 'no permitido' } as any),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(service.updateReservation).not.toHaveBeenCalled();
  });

  it('permite al cliente cancelar su reserva dentro de su scope', async () => {
    accountAccess.allowedClientIds.mockResolvedValue(['client-portal']);
    service.updateReservation.mockResolvedValue({ id: 'res-1', status: 'cancelled_client' });

    const req = {
      organizationId: 'org-1',
      user: { id: 'user-1', role: UserRole.CLIENT, clientId: 'client-portal' },
    } as any;

    await controller.updateReservation(req, 'res-1', { status: 'cancelled_client' } as any);

    expect(service.updateReservation).toHaveBeenCalledWith(
      'org-1',
      'res-1',
      { status: 'cancelled_client' },
      'user-1',
      'client',
      'client-portal',
      ['client-portal'],
    );
  });
});
