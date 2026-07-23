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
    expect(result.publicSlug).toMatch(/^clinica-centro-[a-f0-9]{8}$/);
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
    const mockQb = { where: vi.fn().mockReturnThis(), andWhere: vi.fn().mockReturnThis(), getMany: vi.fn().mockResolvedValue([]), getCount: vi.fn().mockResolvedValue(0), getOne: vi.fn().mockResolvedValue(null) };
    blocks.createQueryBuilder.mockReturnValue(mockQb);
    const manager = {
      query: vi.fn().mockResolvedValue([]),
      getRepository: vi.fn().mockReturnValue({
        createQueryBuilder: vi.fn().mockReturnValue(mockQb),
      }),
    };
    dataSource.transaction.mockImplementation(async (cb: Function) => cb(manager));
    const result = await service.slots('evaluacion', future.toISOString().slice(0, 10), 1);
    expect(Array.isArray(result)).toBe(true);
  });

  it('createCoupon validates code uniqueness', async () => {
    coupons.findOne.mockResolvedValue({ id: 'existing', code: 'DUPE' });
    await expect(service.createCoupon('org-1', 'user-1', { code: 'DUPE', discountType: 'percentage', value: 10 })).rejects.toThrow('Ya existe un cupón');
  });
});
