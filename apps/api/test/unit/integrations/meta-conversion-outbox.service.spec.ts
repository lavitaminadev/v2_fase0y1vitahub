import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MetaConversionOutboxService } from '../../../src/modules/integrations/meta/meta-conversion-outbox.service';

/**
 * El lote se toma dentro de una transaccion porque el bloqueo pesimista lo exige:
 * sobre un `find` suelto, TypeORM lanza PessimisticLockTransactionRequiredError y la
 * cola deja de avanzar sin que aparezca ningun error en la aplicacion. Estas pruebas
 * fijan ese contrato.
 */
function makeService(rows: any[] = []) {
  const outbox: Record<string, any> = {
    findOne: vi.fn().mockResolvedValue(null),
    create: vi.fn((value: any) => value),
    save: vi.fn(async (value: any) => value),
    find: vi.fn().mockResolvedValue(rows),
    update: vi.fn().mockResolvedValue({ affected: rows.length }),
    count: vi.fn().mockResolvedValue(0),
    delete: vi.fn().mockResolvedValue({ affected: 0 }),
    createQueryBuilder: vi.fn((alias?: string) => {
      if (alias) {
        const listBuilder: Record<string, any> = {};
        for (const method of ['where', 'andWhere', 'orderBy', 'skip', 'take']) listBuilder[method] = vi.fn(() => listBuilder);
        listBuilder.getManyAndCount = vi.fn().mockResolvedValue([rows, rows.length]);
        return listBuilder;
      }
      const builder: Record<string, any> = {};
      for (const method of ['update', 'set', 'where']) builder[method] = vi.fn(() => builder);
      builder.execute = vi.fn().mockResolvedValue({ affected: 0 });
      return builder;
    }),
  };
  outbox.manager = {
    transaction: vi.fn(async (callback: any) => callback({ getRepository: () => outbox })),
  };
  const conversions = { sendServerEvent: vi.fn().mockResolvedValue({ events_received: 1 }) };
  const clientPixels = { resolveByPixel: vi.fn().mockResolvedValue('token-123') };
  const service = new MetaConversionOutboxService(outbox as any, conversions as any, clientPixels as any);
  return { service, outbox, conversions, clientPixels };
}

function row(overrides: Record<string, any> = {}) {
  return {
    id: 'row-1', organizationId: 'org-1', pixelId: 'pixel-1', eventId: 'schedule:res-1',
    eventData: {
      eventName: 'Schedule',
      eventTime: 1785340800,
      eventId: 'schedule:res-1',
      userData: { em: ['persona@test.cl'], ph: ['+56912345678'], client_ip_address: '127.0.0.1' },
      customData: { clientId: 'client-1', formId: 'form-1', reservationId: 'res-1', referenceCode: 'ABC123' },
    },
    status: 'pending',
    attempts: 0,
    nextAttemptAt: null,
    processedAt: null,
    lastError: null,
    createdAt: new Date('2026-07-29T10:00:00Z'),
    updatedAt: new Date('2026-07-29T10:00:00Z'),
    ...overrides,
  };
}

describe('MetaConversionOutboxService.processPending', () => {
  beforeEach(() => vi.clearAllMocks());

  it('toma el lote dentro de una transaccion', async () => {
    const { service, outbox } = makeService([row()]);
    await service.processPending(5);
    expect(outbox.manager.transaction).toHaveBeenCalledTimes(1);
    expect(outbox.find).toHaveBeenCalledWith(expect.objectContaining({ lock: { mode: 'pessimistic_write' } }));
  });

  it('marca el lote como processing antes de enviarlo', async () => {
    const { service, outbox, conversions } = makeService([row()]);
    await service.processPending(5);
    expect(outbox.update).toHaveBeenCalledWith(['row-1'], { status: 'processing' });
    expect(conversions.sendServerEvent).toHaveBeenCalledWith('pixel-1', 'token-123', expect.objectContaining({ eventId: 'schedule:res-1' }));
  });

  it('marca como procesado cuando el envio tiene exito', async () => {
    const { service, outbox } = makeService([row()]);
    const result = await service.processPending(5);
    expect(result).toEqual({ processed: 1, failed: 0 });
    expect(outbox.save).toHaveBeenCalledWith(expect.objectContaining({ status: 'processed' }));
  });

  it('no abre transaccion adicional cuando no hay nada pendiente', async () => {
    const { service, outbox, conversions } = makeService([]);
    const result = await service.processPending(5);
    expect(result).toEqual({ processed: 0, failed: 0 });
    expect(outbox.update).not.toHaveBeenCalled();
    expect(conversions.sendServerEvent).not.toHaveBeenCalled();
  });

  it('reintenta con backoff cuando el envio falla de forma transitoria', async () => {
    const { service, outbox, conversions } = makeService([row()]);
    conversions.sendServerEvent.mockRejectedValueOnce(Object.assign(new Error('boom'), { response: { status: 503 } }));
    const result = await service.processPending(5);
    expect(result).toEqual({ processed: 0, failed: 1 });
    expect(outbox.save).toHaveBeenCalledWith(expect.objectContaining({ status: 'retry', attempts: 1 }));
  });

  it('no reintenta cuando el token esta revocado', async () => {
    const { service, outbox, conversions } = makeService([row()]);
    conversions.sendServerEvent.mockRejectedValueOnce(Object.assign(new Error('nope'), {
      response: { status: 400, data: { error: { message: 'Invalid OAuth access token' } } },
    }));
    await service.processPending(5);
    expect(outbox.save).toHaveBeenCalledWith(expect.objectContaining({ status: 'failed' }));
  });

  it('enqueue exige un eventId estable para poder deduplicar en Meta', async () => {
    const { service } = makeService();
    await expect(service.enqueue('org-1', 'pixel-1', { eventName: 'Schedule' } as never))
      .rejects.toThrow('A stable eventId is required');
  });

  it('lista eventos CAPI sin exponer valores personales del matching', async () => {
    const { service } = makeService([row()]);
    const result = await service.listEvents('org-1', {});
    expect(result.items[0].safeEventData.matchKeys).toEqual(expect.arrayContaining(['em', 'ph', 'client_ip_address']));
    expect(JSON.stringify(result.items[0])).not.toContain('persona@test.cl');
    expect(JSON.stringify(result.items[0])).not.toContain('+56912345678');
    expect(result.items[0].safeEventData.customData).toMatchObject({ reservationId: 'res-1', referenceCode: 'ABC123' });
  });

  it('permite reintentar eventos fallidos sin reenviar eventos ya procesados', async () => {
    const failed = row({ status: 'failed', lastError: 'HTTP 500' });
    const { service, outbox } = makeService();
    outbox.findOne.mockResolvedValueOnce(failed).mockResolvedValueOnce(row({ status: 'processed' }));
    await expect(service.retryEvent('org-1', 'row-1')).resolves.toMatchObject({ status: 'retry' });
    await expect(service.retryEvent('org-1', 'row-1')).rejects.toThrow('ya procesado');
  });
});
