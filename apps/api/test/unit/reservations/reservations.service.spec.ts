import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ReservationsService } from '../../../src/modules/reservations/application/reservations.service';

const formQuery = { where: vi.fn(), setLock: vi.fn(), getOne: vi.fn() };
formQuery.where.mockReturnValue(formQuery);
formQuery.setLock.mockReturnValue(formQuery);
const forms = {
  findOne: vi.fn(), exist: vi.fn(), create: vi.fn((value) => value),
  save: vi.fn((value) => value), find: vi.fn(),
  createQueryBuilder: vi.fn(() => formQuery),
};
const reservations = { find: vi.fn(), createQueryBuilder: vi.fn() };
const blocks = { findOne: vi.fn(), find: vi.fn(), remove: vi.fn(), save: vi.fn(), create: vi.fn((v: unknown) => v), createQueryBuilder: vi.fn() };
const events = { create: vi.fn((value) => value), save: vi.fn((value) => value), find: vi.fn() };
const formEvents = { create: vi.fn((value) => value), save: vi.fn((value) => value), findOne: vi.fn() };
const coupons = { findOne: vi.fn(), create: vi.fn((value) => value), save: vi.fn((value) => value) };
const dataSource = { transaction: vi.fn(), query: vi.fn() };
const leadIntake = { captureLead: vi.fn() };
const calendar = { createEvent: vi.fn() };
const metaOutbox = { enqueue: vi.fn(), processPending: vi.fn() };
const clientPixels = { resolve: vi.fn().mockResolvedValue({ pixelId: '', accessToken: undefined }) };
const notifications = { notifyMultiple: vi.fn() };
const emails = { send: vi.fn() };
const audit = { log: vi.fn() };

function publishedForm() {
  return {
    id: 'form-1', organizationId: 'org-secret', clientId: 'client-secret', createdBy: 'user-secret',
    name: 'Evaluación', publicSlug: 'evaluacion', status: 'published', mode: 'appointment',
    timezone: 'America/Santiago', durationMinutes: 60, bufferMinutes: 0, capacityPerSlot: 1,
    minimumNoticeHours: 1, maximumAdvanceDays: 60, confirmationMode: 'automatic',
    fieldSchema: [{ id: 'name', type: 'text', label: 'Nombre', required: true }, { id: 'consent', type: 'consent', label: 'Acepto', required: true }, { id: 'secret', type: 'text', label: 'Interno', internal: true }],
    designConfig: {}, scheduleConfig: { windows: [{ day: 1, start: '09:00', end: '18:00' }] },
    servicesConfig: [], resourcesConfig: [], campaignId: 'campaign-secret',
  };
}

describe('ReservationsService', () => {
  let service: ReservationsService;
  beforeEach(() => {
    vi.clearAllMocks();
    // mockReset descarta las colas de mockResolvedValueOnce que un test previo haya dejado sin
    // consumir: clearAllMocks solo limpia las llamadas y esas colas se filtran al test siguiente.
    dataSource.query.mockReset();
    dataSource.query.mockResolvedValue([{ capabilities: { reservations: true, crm: true, metaConversions: false } }]);
    formQuery.where.mockReturnValue(formQuery); formQuery.setLock.mockReturnValue(formQuery);
    service = new ReservationsService(forms as never, reservations as never, blocks as never, events as never, formEvents as never, coupons as never, dataSource as never, leadIntake as never, calendar as never, metaOutbox as never, clientPixels as never, notifications as never, emails as never, audit as never);
  });

  it('does not expose tenant or attribution configuration in the public form', async () => {
    formQuery.getOne.mockResolvedValue(publishedForm());
    const result = await service.publicForm('evaluacion');
    expect(result).not.toHaveProperty('organizationId');
    expect(result).not.toHaveProperty('clientId');
    expect(result).not.toHaveProperty('campaignId');
    expect(result.fieldSchema).toEqual([{ id: 'name', type: 'text', label: 'Nombre', required: true }, { id: 'consent', type: 'consent', label: 'Acepto', required: true }]);
  });

  it('creates a unique public slug and checks client ownership', async () => {
    dataSource.query.mockResolvedValue([{ id: 'client-1' }]);
    forms.exist.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    const result = await service.createForm('org-1', 'user-1', { clientId: 'client-1', name: 'Clínica Centro' });
    expect(dataSource.query).toHaveBeenCalledWith(expect.stringContaining('organization_id'), ['client-1', 'org-1']);
    // randomBytes(3) produce 6 caracteres hex. El sufijo solo se agrega cuando
    // el slug ya existe, y el bucle reintenta ante colision, asi que 6 basta.
    expect(result.publicSlug).toMatch(/^clinica-centro-[a-f0-9]{6}$/);
    expect(result.fieldSchema).toEqual(expect.arrayContaining([expect.objectContaining({ id: 'consent', required: true })]));
  });

  it('deduplicates funnel events from the same public session', async () => {
    formQuery.getOne.mockResolvedValue(publishedForm());
    const existing = { id: 'event-1', type: 'view' };
    formEvents.findOne.mockResolvedValue(existing);
    await expect(service.trackPublicEvent('evaluacion', { type: 'view', sessionId: 'session-1' })).resolves.toBe(existing);
    expect(formEvents.save).not.toHaveBeenCalled();
  });

  it('returns metrics with configurable days', async () => {
    dataSource.query
      .mockResolvedValueOnce([{ total: 10, pending: 2, confirmed: 5, attended: 3, no_show: 1, waitlist: 0, cancelled: 1 }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ views: 100, starts: 40 }]);
    const result = await service.metrics('org-1', undefined, undefined, '60');
    expect(result.totals.total).toBe(10);
    expect(result.funnel.views).toBe(100);
    expect(result.days).toBe(60);
  });

  it('clamps days between 1 and 365', async () => {
    dataSource.query
      .mockResolvedValue([{ total: 0, pending: 0, confirmed: 0, attended: 0, no_show: 0, waitlist: 0, cancelled: 0 }])
      .mockResolvedValue([])
      .mockResolvedValue([])
      .mockResolvedValue([{ views: 0, starts: 0 }]);
    const result = await service.metrics('org-1', undefined, undefined, '9999');
    expect(result.days).toBe(365);
  });

  it('exportCsv includes answer columns', async () => {
    const items = [{ referenceCode: 'R1', guestName: 'Test', guestEmail: 'test@test.cl', guestPhone: '', startsAt: new Date('2026-07-22T15:00:00Z'), status: 'confirmed', utmSource: 'direct', utmCampaign: undefined, couponCode: undefined, partySize: 2, internalNotes: 'Test note', answers: { color: 'red' } }];
    reservations.createQueryBuilder.mockReturnValue({
      where: vi.fn().mockReturnThis(),
      andWhere: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      take: vi.fn().mockReturnThis(),
      getMany: vi.fn().mockResolvedValue(items),
    });
    const csv = await service.exportCsv('org-1');
    expect(csv).toContain('R1');
    expect(csv).toContain('"color"');
    expect(csv).toContain('red');
  });

  it('removeBlock logs audit', async () => {
    blocks.findOne.mockResolvedValue({ id: 'block-1', startsAt: new Date('2026-07-22T10:00:00Z'), endsAt: new Date('2026-07-22T11:00:00Z'), reason: 'Testing', formId: 'form-1', organizationId: 'org-1' });
    const result = await service.removeBlock('org-1', 'block-1', undefined, undefined, 'user-1');
    expect(result.deleted).toBe(true);
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ entityId: 'block-1', actorId: 'user-1', action: 'deleted' }));
  });

  it('createPublic rejects honeypot website', async () => {
    formQuery.getOne.mockResolvedValue(publishedForm());
    formQuery.setLock.mockReturnValue(formQuery);
    dataSource.transaction.mockImplementation(async (cb: Function) => cb({ query: vi.fn(), getRepository: vi.fn() }));
    await expect(service.createPublic('evaluacion', { website: 'spam', startsAt: new Date().toISOString(), guestName: 'Test', partySize: 1, idempotencyKey: 'ik', renderedAt: new Date(Date.now() - 10000).toISOString(), consentVersion: 'v1', fbc: undefined, fbp: undefined })).rejects.toThrow('Solicitud inválida');
  });

  it('createPublic rejects too-fast submission', async () => {
    formQuery.getOne.mockResolvedValue(publishedForm());
    await expect(service.createPublic('evaluacion', { startsAt: new Date().toISOString(), guestName: 'Test', partySize: 1, idempotencyKey: 'ik', renderedAt: new Date().toISOString(), consentVersion: 'v1', fbc: undefined, fbp: undefined })).rejects.toThrow('Completa el formulario antes de enviarlo');
  });

  it('slots returns available times', async () => {
    const now = new Date();
    const future = new Date(now.getTime() + 86400000);
    formQuery.getOne.mockResolvedValue(publishedForm());
    formQuery.setLock.mockReturnValue(formQuery);
    dataSource.query
      .mockResolvedValueOnce([{ capabilities: { reservations: true, crm: true, metaConversions: false } }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    const mockQb = { select: vi.fn().mockReturnThis(), where: vi.fn().mockReturnThis(), andWhere: vi.fn().mockReturnThis(), getMany: vi.fn().mockResolvedValue([]), getCount: vi.fn().mockResolvedValue(0), getOne: vi.fn().mockResolvedValue(null) };
    blocks.createQueryBuilder.mockReturnValue(mockQb);
    reservations.createQueryBuilder.mockReturnValue(mockQb);
    const manager = {
      query: vi.fn().mockResolvedValue([]),
      getRepository: vi.fn().mockReturnValue({
        createQueryBuilder: vi.fn().mockReturnValue(mockQb),
      }),
    };
    dataSource.transaction.mockImplementation(async (cb: Function) => cb(manager));
    const result = await service.slots('evaluacion', future.toISOString().slice(0, 10), 1);
    expect(Array.isArray(result.slots)).toBe(true);
    expect(Array.isArray(result.fullDays)).toBe(true);
  });

  /**
   * Criterios de aceptación del documento "CRM básico y Reservas", sección 8: son los
   * casos que Nico corre él mismo contra la página pública.
   */
  describe('criterios de aceptación de disponibilidad', () => {
    function slotsScenario(form: Record<string, unknown>, existingReservations: unknown[] = [], blockRows: unknown[] = []) {
      formQuery.getOne.mockResolvedValue(form);
      formQuery.setLock.mockReturnValue(formQuery);
      reservations.createQueryBuilder.mockReturnValue({
        select: vi.fn().mockReturnThis(), where: vi.fn().mockReturnThis(), andWhere: vi.fn().mockReturnThis(),
        getMany: vi.fn().mockResolvedValue(existingReservations),
      });
      blocks.createQueryBuilder.mockReturnValue({
        select: vi.fn().mockReturnThis(), where: vi.fn().mockReturnThis(), andWhere: vi.fn().mockReturnThis(),
        getMany: vi.fn().mockResolvedValue(blockRows),
      });
    }

    /** Un lunes futuro, que es el único día con ventana horaria en `publishedForm`. */
    function nextMonday(): string {
      const now = new Date();
      const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
      date.setUTCDate(date.getUTCDate() + ((8 - date.getUTCDay()) % 7 || 7));
      return date.toISOString().slice(0, 10);
    }

    it('ofrece horarios cuando el día está abierto y sin tope alcanzado', async () => {
      const day = nextMonday();
      slotsScenario({ ...publishedForm(), dailyCapacity: 5 });
      const result = await service.slots('evaluacion', day, 1);
      expect(result.slots.length).toBeGreaterThan(0);
      expect(result.fullDays).toEqual([]);
    });

    it('marca el día completo cuando el tope del cliente se alcanzó, aunque el del formulario no', async () => {
      const day = nextMonday();
      const startsAt = new Date(`${day}T13:00:00.000Z`);
      // El formulario admite 10 al día y solo lleva 2, pero el cliente topó en 2.
      slotsScenario(
        { ...publishedForm(), dailyCapacity: 10 },
        [{ startsAt, endsAt: startsAt, partySize: 1 }, { startsAt, endsAt: startsAt, partySize: 1 }],
      );
      dataSource.query.mockResolvedValue([{ daily_reservation_cap: 2 }]);

      const result = await service.slots('evaluacion', day, 1);

      expect(result.slots).toEqual([]);
      expect(result.fullDays).toEqual([day]);
    });

    it('deja el día sin horarios y lo marca completo cuando se alcanzó el tope diario', async () => {
      const day = nextMonday();
      const startsAt = new Date(`${day}T13:00:00.000Z`);
      slotsScenario(
        { ...publishedForm(), dailyCapacity: 2 },
        [{ startsAt, endsAt: startsAt, partySize: 1 }, { startsAt, endsAt: startsAt, partySize: 1 }],
      );
      const result = await service.slots('evaluacion', day, 1);
      expect(result.slots).toEqual([]);
      expect(result.fullDays).toEqual([day]);
    });

    it('excluye las horas cubiertas por un bloqueo sin marcar el día como completo', async () => {
      const day = nextMonday();
      const open = await (async () => {
        slotsScenario(publishedForm());
        return service.slots('evaluacion', day, 1);
      })();
      slotsScenario(publishedForm(), [], [{
        startsAt: new Date(`${day}T00:00:00.000Z`),
        endsAt: new Date(`${day}T23:59:59.000Z`),
      }]);
      const blocked = await service.slots('evaluacion', day, 1);
      expect(open.slots.length).toBeGreaterThan(0);
      expect(blocked.slots).toEqual([]);
      expect(blocked.fullDays).toEqual([]);
    });
  });

  it('createCoupon validates code uniqueness', async () => {
    coupons.findOne.mockResolvedValue({ id: 'existing', code: 'DUPE' });
    await expect(service.createCoupon('org-1', 'user-1', { code: 'DUPE', discountType: 'percentage', value: 10 })).rejects.toThrow('Ya existe un cupón');
  });

  it('rejects clearing availability on a form that is already published', async () => {
    dataSource.query.mockResolvedValue([{ capabilities: { reservations: true, crm: true, metaConversions: false } }]);
    forms.findOne.mockResolvedValue(publishedForm());
    await expect(service.updateForm('org-1', 'form-1', { scheduleConfig: { windows: [] } } as never))
      .rejects.toThrow('No puedes publicar sin disponibilidad');
    expect(forms.save).not.toHaveBeenCalled();
  });

  it('keeps rejecting a publish attempt without availability', async () => {
    dataSource.query.mockResolvedValue([{ capabilities: { reservations: true, crm: true, metaConversions: false } }]);
    forms.findOne.mockResolvedValue({ ...publishedForm(), status: 'draft' });
    await expect(service.updateForm('org-1', 'form-1', { status: 'published', scheduleConfig: { windows: [] } } as never))
      .rejects.toThrow('No puedes publicar sin disponibilidad');
  });

  it('hides a published form with invalid stored configuration instead of leaking the validation error', async () => {
    formQuery.getOne.mockResolvedValue({ ...publishedForm(), designConfig: { primaryColor: 'rojo' } });
    await expect(service.publicForm('evaluacion')).rejects.toThrow('Este formulario no está disponible');
  });

  /**
   * Defensas del formulario público contra envíos automáticos.
   *
   * Ambas actúan antes de tocar la base de datos: una reserva falsa no solo ensucia la
   * agenda, dispara un evento de conversión a Meta y degrada la señal de la campaña.
   */
  describe('protección del formulario público', () => {
    const validPayload = {
      startsAt: new Date(Date.now() + 86_400_000).toISOString(),
      guestName: 'Ana Pérez', answers: {}, idempotencyKey: 'key-1',
    } as never;

    it('descarta el envío que rellenó el campo trampa', async () => {
      await expect(service.createPublic('evaluacion', { ...(validPayload as object), website: 'http://spam.example' } as never))
        .rejects.toThrow('Solicitud inválida');
    });

    it('descarta el envío completado en menos de 800 ms', async () => {
      await expect(service.createPublic('evaluacion', { ...(validPayload as object), renderedAt: new Date().toISOString() } as never))
        .rejects.toThrow('Completa el formulario antes de enviarlo');
    });

    it('deja pasar un envío humano: campo trampa vacío y tiempo razonable', async () => {
      // No llega a crear la reserva —el escenario no está montado— pero supera las guardas.
      await expect(service.createPublic('evaluacion', { ...(validPayload as object), website: '', renderedAt: new Date(Date.now() - 30_000).toISOString() } as never))
        .rejects.not.toThrow('Solicitud inválida');
    });
  });

  /**
   * El dia y la hora de un cupon describen cuando se consume el beneficio, no cuando se
   * pide la reserva. Validarlos contra el reloj del servidor hacia que un cupon de martes
   * fallara al reservarse un lunes, y que uno vencido se aceptara si se reservaba a tiempo.
   */
  describe('vigencia de cupones', () => {
    function couponScenario(coupon: Record<string, unknown>) {
      const manager = { getRepository: () => ({ findOne: async () => ({ code: 'PROMO', active: true, maxUses: 0, usageCount: 0, ...coupon }) }) };
      return manager as never;
    }
    // Martes 20:00 en America/Santiago (UTC-3 en enero).
    const martes20 = new Date('2026-01-20T23:00:00.000Z');
    const form = { id: 'form-1', organizationId: 'org-1', timezone: 'America/Santiago' } as never;

    it('acepta el cupon segun el dia de la reserva, no el dia en que se reserva', async () => {
      // 2 = martes. La reserva cae en martes aunque hoy sea cualquier otro dia.
      const coupon = await service['validateCoupon']('PROMO', form, couponScenario({ validDaysOfWeek: [2] }), martes20);
      expect(coupon?.code).toBe('PROMO');
    });

    it('rechaza el cupon cuando la reserva cae en un dia no permitido', async () => {
      await expect(service['validateCoupon']('PROMO', form, couponScenario({ validDaysOfWeek: [1] }), martes20))
        .rejects.toThrow('El cupón no es válido para el día de la reserva');
    });

    it('acepta la reserva dentro de la franja horaria del cupon', async () => {
      const coupon = await service['validateCoupon']('PROMO', form, couponScenario({ validFromTime: '19:00', validUntilTime: '23:00' }), martes20);
      expect(coupon?.code).toBe('PROMO');
    });

    it('rechaza la reserva fuera de la franja horaria del cupon', async () => {
      await expect(service['validateCoupon']('PROMO', form, couponScenario({ validFromTime: '12:00', validUntilTime: '16:00' }), martes20))
        .rejects.toThrow('El cupón solo aplica entre 12:00 y 16:00');
    });

    it('sin franja declarada el cupon vale a cualquier hora', async () => {
      const coupon = await service['validateCoupon']('PROMO', form, couponScenario({}), martes20);
      expect(coupon?.code).toBe('PROMO');
    });
  });
});
