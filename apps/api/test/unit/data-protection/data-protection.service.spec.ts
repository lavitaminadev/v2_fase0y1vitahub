import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DataProtectionService } from '../../../src/core/data-protection/data-protection.service';

/**
 * La anonimizacion tiene que alcanzar los datos del comensal, que viven en las reservas y
 * en los contactos de campana, no solo en los usuarios y prospectos. Y siempre debe dejar
 * rastro en la bitacora, porque el dato original ya no se puede recuperar.
 */
describe('DataProtectionService', () => {
  let reservationRepo: any;
  let contactRepo: any;
  let auditRepo: any;
  let service: DataProtectionService;

  beforeEach(() => {
    vi.clearAllMocks();
    auditRepo = {
      create: vi.fn((value) => value),
      save: vi.fn(async (value) => value),
      update: vi.fn(),
    };
    reservationRepo = {
      findOneBy: vi.fn(),
      find: vi.fn().mockResolvedValue([]),
      save: vi.fn(async (value) => value),
    };
    contactRepo = {
      findOneBy: vi.fn(),
      save: vi.fn(async (value) => value),
    };
    service = new DataProtectionService(
      {} as never, {} as never, auditRepo as never, {} as never, contactRepo as never, reservationRepo as never,
    );
  });

  it('borra el contacto y los identificadores de match de una reserva, conservando fecha y estado', async () => {
    const startsAt = new Date('2026-01-15T20:00:00.000Z');
    reservationRepo.findOneBy.mockResolvedValue({
      id: 'abcdef12-0000-0000-0000-000000000000',
      organizationId: 'org-1',
      guestName: 'Ana Perez',
      guestEmail: 'ana@example.com',
      guestPhone: '+56911111111',
      answers: { alergia: 'mani' },
      internalNotes: 'Mesa junto a la ventana',
      fbc: 'fb.1.123', fbp: 'fb.1.456',
      clientIpAddress: '190.0.0.1', clientUserAgent: 'Mozilla/5.0',
      status: 'attended', startsAt,
    });

    const result = await service.anonymizeReservation('abcdef12-0000-0000-0000-000000000000', 'org-1');

    expect(result.guestName).toBe('Visitante anonimizado abcdef12');
    expect(result.guestEmail).toBeNull();
    expect(result.guestPhone).toBeNull();
    expect(result.answers).toEqual({});
    expect(result.internalNotes).toBeNull();
    expect(result.fbc).toBeNull();
    expect(result.fbp).toBeNull();
    expect(result.clientIpAddress).toBeNull();
    expect(result.clientUserAgent).toBeNull();
    // La analitica de asistencia depende de estos dos.
    expect(result.status).toBe('attended');
    expect(result.startsAt).toBe(startsAt);
  });

  it('deja rastro en la bitacora al anonimizar', async () => {
    reservationRepo.findOneBy.mockResolvedValue({
      id: 'abcdef12-0000-0000-0000-000000000000', organizationId: 'org-1',
      guestName: 'Ana', answers: {}, startsAt: new Date(),
    });

    await service.anonymizeReservation('abcdef12-0000-0000-0000-000000000000', 'org-1', 'Solicitud del titular');

    expect(auditRepo.save).toHaveBeenCalledWith(expect.objectContaining({
      organizationId: 'org-1',
      action: 'anonymize',
      entityType: 'Reservation',
      reason: 'Solicitud del titular',
    }));
  });

  it('anonimiza el contacto de campana conservando su identidad interna', async () => {
    contactRepo.findOneBy.mockResolvedValue({
      id: 'feedbeef-0000-0000-0000-000000000000', organizationId: 'org-1',
      name: 'Juan Soto', email: 'juan@example.com', phone: '+56922222222',
    });

    const result = await service.anonymizeContact('feedbeef-0000-0000-0000-000000000000', 'org-1');

    expect(result.name).toBe('Contacto anonimizado feedbeef');
    expect(result.email).toBeNull();
    expect(result.phone).toBeNull();
  });

  it('omite las reservas ya anonimizadas para poder reejecutar el barrido', async () => {
    reservationRepo.find.mockResolvedValue([
      { id: 'aaaaaaaa-0000-0000-0000-000000000000', organizationId: 'org-1', guestName: 'Visitante anonimizado aaaaaaaa', guestEmail: null, guestPhone: null },
    ]);

    const result = await service.anonymizeExpiredReservations(180);

    expect(result.reviewed).toBe(1);
    expect(result.anonymized).toBe(0);
    expect(reservationRepo.save).not.toHaveBeenCalled();
  });
});
