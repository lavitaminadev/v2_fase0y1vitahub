import { of } from 'rxjs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MetaConversionsService } from '../../../src/modules/integrations/meta/meta-conversions.service';

describe('MetaConversionsService', () => {
  const originalTestCode = process.env.META_TEST_EVENT_CODE;

  afterEach(() => {
    if (originalTestCode === undefined) delete process.env.META_TEST_EVENT_CODE;
    else process.env.META_TEST_EVENT_CODE = originalTestCode;
  });

  it('maps CRM fields to the Meta CAPI contract and hashes identifiers', async () => {
    process.env.META_TEST_EVENT_CODE = 'TEST123';
    const post = vi.fn().mockReturnValue(of({ data: { events_received: 1 } }));
    const service = new MetaConversionsService({ post } as any);

    await service.sendServerEvent('pixel-1', 'server-token', {
      eventName: 'Lead',
      eventTime: 1700000000,
      actionSource: 'system_generated',
      userData: { em: [' Person@Example.com '] },
      eventId: 'event-1',
    });

    const payload = post.mock.calls[0][1];
    expect(payload.test_event_code).toBe('TEST123');
    expect(payload.data[0]).toEqual(expect.objectContaining({
      event_name: 'Lead',
      event_time: 1700000000,
      action_source: 'system_generated',
      event_id: 'event-1',
    }));
    expect(payload.data[0].user_data.em[0]).not.toContain('Person@Example.com');
  });

  describe('normalización de teléfono antes del hash', () => {
    const originalCountryCode = process.env.META_PHONE_DEFAULT_COUNTRY_CODE;

    afterEach(() => {
      if (originalCountryCode === undefined) delete process.env.META_PHONE_DEFAULT_COUNTRY_CODE;
      else process.env.META_PHONE_DEFAULT_COUNTRY_CODE = originalCountryCode;
    });

    /** Devuelve el número tal como se hashea, resolviendo el hash contra los candidatos dados. */
    async function normalizedFrom(phone: string, candidates: string[]): Promise<string | undefined> {
      const post = vi.fn().mockReturnValue(of({ data: {} }));
      const service = new MetaConversionsService({ post } as any);
      await service.sendServerEvent('pixel-1', 'token', {
        eventName: 'Lead', eventTime: 1700000000, actionSource: 'website',
        userData: { ph: [phone] }, eventId: 'event-1',
      });
      const hashed = post.mock.calls[0][1].data[0].user_data.ph[0];
      const { createHash } = await import('crypto');
      return candidates.find((candidate) => createHash('sha256').update(candidate).digest('hex') === hashed);
    }

    it('antepone el código de país a un número local chileno', async () => {
      await expect(normalizedFrom('912345678', ['56912345678'])).resolves.toBe('56912345678');
    });

    it('quita el cero inicial de un número local escrito con cero', async () => {
      // Tenía diez dígitos, así que la heurística anterior lo daba por internacional y lo
      // enviaba con el cero y sin código de país: dos incumplimientos a la vez.
      await expect(normalizedFrom('0912345678', ['56912345678'])).resolves.toBe('56912345678');
    });

    it('respeta un número internacional escrito con +, sin anteponer nada', async () => {
      // Un móvil extranjero de nueve dígitos recibía el prefijo chileno y se convertía en un
      // número inexistente. El + es la señal de que ya viene completo.
      await expect(normalizedFrom('+51987654321', ['51987654321'])).resolves.toBe('51987654321');
    });

    it('completa un número de diez dígitos sin código de país', async () => {
      process.env.META_PHONE_DEFAULT_COUNTRY_CODE = '1';
      await expect(normalizedFrom('(415) 555-2671', ['14155552671'])).resolves.toBe('14155552671');
    });

    it('no duplica el código de país cuando ya viene incluido', async () => {
      await expect(normalizedFrom('+56912345678', ['56912345678'])).resolves.toBe('56912345678');
    });
  });
});
