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
const blocks = { find: vi.fn(), createQueryBuilder: vi.fn() };
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
    service = new ReservationsService(forms as never, reservations as never, blocks as never, events as never, formEvents as never, coupons as never, dataSource as never, leadIntake as never, calendar as never, metaOutbox as never, clientPixels as never, notifications as never, emails as never);
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
});
