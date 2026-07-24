import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GoogleConversionOutboxService } from '../../../src/modules/integrations/google/google-conversion-outbox.service';
import { IntegrationAccountType } from '../../../src/modules/integrations/integration-account-type.enum';

function makeService(overrides: Record<string, any> = {}) {
  const outbox = {
    findOne: vi.fn().mockResolvedValue(null),
    create: vi.fn((value: any) => value),
    save: vi.fn(async (value: any) => ({ id: 'row-1', attempts: 0, ...value })),
    find: vi.fn().mockResolvedValue([]),
    count: vi.fn().mockResolvedValue(0),
    delete: vi.fn().mockResolvedValue({ affected: 0 }),
    ...overrides.outbox,
  };
  const integrations = { findOne: vi.fn().mockResolvedValue(null), ...overrides.integrations };
  const accounts = { find: vi.fn().mockResolvedValue([]), ...overrides.accounts };
  const conversions = { uploadClickConversions: vi.fn().mockResolvedValue({ results: [] }), ...overrides.conversions };
  const oauth = { refreshIntegration: vi.fn(), ...overrides.oauth };

  const service = new GoogleConversionOutboxService(
    outbox as any, integrations as any, accounts as any, conversions as any, oauth as any,
  );
  return { service, outbox, integrations, accounts, conversions, oauth };
}

describe('GoogleConversionOutboxService.resolveConfig', () => {
  it('devuelve null si la organizacion no tiene Google conectado', async () => {
    const { service } = makeService();
    expect(await service.resolveConfig('org-1', 'client-1', 'schedule')).toBeNull();
  });

  it('devuelve null si no hay cuenta de Ads', async () => {
    const { service } = makeService({ integrations: { findOne: vi.fn().mockResolvedValue({ id: 'int-1' }) } });
    expect(await service.resolveConfig('org-1', 'client-1', 'schedule')).toBeNull();
  });

  it('devuelve null si la cuenta no configuro la accion de conversion', async () => {
    const { service } = makeService({
      integrations: { findOne: vi.fn().mockResolvedValue({ id: 'int-1' }) },
      accounts: { find: vi.fn().mockResolvedValue([{ externalId: '123-456-7890', metadata: { clientId: 'client-1' } }]) },
    });
    expect(await service.resolveConfig('org-1', 'client-1', 'schedule')).toBeNull();
  });

  it('arma el nombre de recurso y limpia guiones del customer id', async () => {
    const { service } = makeService({
      integrations: { findOne: vi.fn().mockResolvedValue({ id: 'int-1' }) },
      accounts: {
        find: vi.fn().mockResolvedValue([{
          externalId: '123-456-7890',
          accountType: IntegrationAccountType.AD_ACCOUNT,
          metadata: { clientId: 'client-1', conversionActions: { schedule: '999' } },
        }]),
      },
    });
    expect(await service.resolveConfig('org-1', 'client-1', 'schedule')).toEqual({
      customerId: '1234567890',
      conversionAction: 'customers/1234567890/conversionActions/999',
    });
  });

  it('prefiere la cuenta del cliente cuando hay varias', async () => {
    const { service } = makeService({
      integrations: { findOne: vi.fn().mockResolvedValue({ id: 'int-1' }) },
      accounts: {
        find: vi.fn().mockResolvedValue([
          { externalId: '111', metadata: { clientId: 'otro', conversionActions: { schedule: 'a' } } },
          { externalId: '222', metadata: { clientId: 'client-1', conversionActions: { schedule: 'b' } } },
        ]),
      },
    });
    const config = await service.resolveConfig('org-1', 'client-1', 'schedule');
    expect(config?.conversionAction).toBe('customers/222/conversionActions/b');
  });
});

describe('GoogleConversionOutboxService.enqueue', () => {
  const config = { customerId: '123', conversionAction: 'customers/123/conversionActions/9' };
  const conversion = {
    conversionDateTime: new Date('2026-07-24T18:30:45Z'),
    timezone: 'America/Santiago',
    userData: { email: 'a@b.com' },
  };

  it('exige un eventId estable', async () => {
    const { service } = makeService();
    await expect(service.enqueue('org-1', config, '', conversion as any)).rejects.toThrow(/stable eventId/);
  });

  it('no duplica si el evento ya esta encolado', async () => {
    const existing = { id: 'ya-existe' };
    const { service, outbox } = makeService({ outbox: { findOne: vi.fn().mockResolvedValue(existing) } });
    expect(await service.enqueue('org-1', config, 'schedule:res-1', conversion as any)).toBe(existing);
    expect(outbox.save).not.toHaveBeenCalled();
  });

  it('serializa la fecha para poder guardarla en JSON', async () => {
    const { service, outbox } = makeService();
    await service.enqueue('org-1', config, 'schedule:res-1', conversion as any);
    const saved = outbox.save.mock.calls[0][0];
    expect(saved.conversionData.conversionDateTime).toBe('2026-07-24T18:30:45.000Z');
    expect(saved.customerId).toBe('123');
  });
});

describe('GoogleConversionOutboxService.processPending', () => {
  const row = () => ({
    id: 'row-1', organizationId: 'org-1', customerId: '123',
    conversionAction: 'customers/123/conversionActions/9',
    conversionData: { conversionDateTime: '2026-07-24T18:30:45.000Z', timezone: 'UTC', userData: {}, gclid: 'g1' },
    status: 'pending', attempts: 0,
  });

  const connected = {
    integrations: { findOne: vi.fn().mockResolvedValue({ id: 'int-1', config: { accessToken: 'plain:token' } }) },
  };

  it('marca como procesado tras subir la conversion', async () => {
    const item = row();
    const { service, outbox, conversions } = makeService({
      ...connected, outbox: { find: vi.fn().mockResolvedValue([item]) },
    });
    const result = await service.processPending();
    expect(result).toEqual({ processed: 1, failed: 0 });
    expect(conversions.uploadClickConversions).toHaveBeenCalledOnce();
    expect(outbox.save.mock.calls[0][0].status).toBe('processed');
  });

  it('reintenta con backoff exponencial ante error transitorio', async () => {
    const item = row();
    const { service, outbox } = makeService({
      ...connected,
      outbox: { find: vi.fn().mockResolvedValue([item]) },
      conversions: { uploadClickConversions: vi.fn().mockRejectedValue(new Error('503 backend error')) },
    });
    const result = await service.processPending();
    expect(result).toEqual({ processed: 0, failed: 1 });
    const saved = outbox.save.mock.calls[0][0];
    expect(saved.status).toBe('retry');
    expect(saved.attempts).toBe(1);
    expect(saved.nextAttemptAt).toBeInstanceOf(Date);
  });

  it('no reintenta errores de payload invalido', async () => {
    const item = row();
    const { service, outbox } = makeService({
      ...connected,
      outbox: { find: vi.fn().mockResolvedValue([item]) },
      conversions: { uploadClickConversions: vi.fn().mockRejectedValue(new Error('INVALID_ARGUMENT: bad action')) },
    });
    await service.processPending();
    const saved = outbox.save.mock.calls[0][0];
    expect(saved.status).toBe('failed');
    expect(saved.nextAttemptAt).toBeUndefined();
  });

  it('marca token expirado como no reintentable y lo etiqueta', async () => {
    const item = row();
    const { service, outbox } = makeService({
      ...connected,
      outbox: { find: vi.fn().mockResolvedValue([item]) },
      conversions: { uploadClickConversions: vi.fn().mockRejectedValue(new Error('UNAUTHENTICATED')) },
    });
    await service.processPending();
    const saved = outbox.save.mock.calls[0][0];
    expect(saved.status).toBe('failed');
    expect(saved.lastError).toMatch(/^\[TOKEN\]/);
  });

  it('falla definitivamente al octavo intento', async () => {
    const item = { ...row(), attempts: 7 };
    const { service, outbox } = makeService({
      ...connected,
      outbox: { find: vi.fn().mockResolvedValue([item]) },
      conversions: { uploadClickConversions: vi.fn().mockRejectedValue(new Error('503')) },
    });
    await service.processPending();
    expect(outbox.save.mock.calls[0][0].status).toBe('failed');
  });

  it('falla si la organizacion no tiene Google conectado', async () => {
    const item = row();
    const { service, outbox } = makeService({ outbox: { find: vi.fn().mockResolvedValue([item]) } });
    const result = await service.processPending();
    expect(result).toEqual({ processed: 0, failed: 1 });
    expect(outbox.save.mock.calls[0][0].lastError).toMatch(/not connected/);
  });
});
