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
    createQueryBuilder: vi.fn(() => {
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
    eventData: { eventName: 'Schedule', eventId: 'schedule:res-1' }, status: 'pending',
    attempts: 0, ...overrides,
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

  it('descarta el evento que supera los 7 días sin gastar reintentos ni llamar a Meta', async () => {
    const hace8Dias = Math.floor((Date.now() - 8 * 86_400_000) / 1000);
    const { service, outbox, conversions } = makeService([
      row({ eventData: { eventName: 'Reserva_Asistida', eventId: 'reserva_asistida:res-1', eventTime: hace8Dias } }),
    ]);

    const result = await service.processPending(5);

    expect(conversions.sendServerEvent).not.toHaveBeenCalled();
    expect(outbox.save).toHaveBeenCalledWith(expect.objectContaining({ status: 'expired', attempts: 0 }));
    expect(result.failed).toBe(1);
  });

  it('envía normalmente un evento dentro de la ventana de 7 días', async () => {
    const ayer = Math.floor((Date.now() - 86_400_000) / 1000);
    const { service, conversions } = makeService([
      row({ eventData: { eventName: 'Reserva_Asistida', eventId: 'reserva_asistida:res-1', eventTime: ayer } }),
    ]);

    const result = await service.processPending(5);

    expect(conversions.sendServerEvent).toHaveBeenCalledTimes(1);
    expect(result.processed).toBe(1);
  });

  it('acepta hasta 62 días un evento de tienda física', async () => {
    // La asistencia se marca cuando alguien la registra, no cuando el comensal llega. Con el
    // corte de 7 días para todo, cada carga con retraso se descartaba aunque Meta la aceptara.
    const hace30Dias = Math.floor((Date.now() - 30 * 86_400_000) / 1000);
    const { service, conversions } = makeService([
      row({ eventData: { eventName: 'Reserva_Asistida', eventId: 'reserva_asistida:res-1', actionSource: 'physical_store', eventTime: hace30Dias } }),
    ]);

    const result = await service.processPending(5);

    expect(conversions.sendServerEvent).toHaveBeenCalledTimes(1);
    expect(result.processed).toBe(1);
  });

  it('descarta un evento de tienda física pasados los 62 días', async () => {
    const hace70Dias = Math.floor((Date.now() - 70 * 86_400_000) / 1000);
    const { service, outbox, conversions } = makeService([
      row({ eventData: { eventName: 'Reserva_Asistida', eventId: 'reserva_asistida:res-1', actionSource: 'physical_store', eventTime: hace70Dias } }),
    ]);

    await service.processPending(5);

    expect(conversions.sendServerEvent).not.toHaveBeenCalled();
    expect(outbox.save).toHaveBeenCalledWith(expect.objectContaining({ status: 'expired' }));
  });

  it('reconoce el token revocado por el código 190 aunque el texto no lo diga', async () => {
    // Es el caso de un cambio de contraseña: el mensaje dice "invalidated", que ninguna
    // variante del texto reconocía, así que caía a fallo genérico y el aviso nunca salía.
    const { service, outbox, conversions } = makeService([row()]);
    conversions.sendServerEvent.mockRejectedValue({
      response: { status: 400, data: { error: { message: 'The session has been invalidated because the user changed their password', code: 190, type: 'OAuthException' } } },
      message: 'Request failed with status code 400',
    });

    await service.processPending(5);

    expect(outbox.save).toHaveBeenCalledWith(expect.objectContaining({
      status: 'failed',
      lastError: expect.stringContaining('[TOKEN]'),
    }));
  });

  it('cuenta los vencidos aparte para que la suma de estados cuadre', async () => {
    const { service, outbox } = makeService();
    outbox.count.mockResolvedValue(3);

    const stats = await service.stats('org-1');

    expect(stats.expired).toBe(3);
  });

  it('enqueue exige un eventId estable para poder deduplicar en Meta', async () => {
    const { service } = makeService();
    await expect(service.enqueue('org-1', 'pixel-1', { eventName: 'Schedule' } as never))
      .rejects.toThrow('A stable eventId is required');
  });
});
