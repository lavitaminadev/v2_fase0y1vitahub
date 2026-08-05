import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import {
  buildUserIdentifiers,
  formatConversionDateTime,
  GoogleConversionsService,
  normalizePhoneForGoogle,
} from '../../../src/modules/integrations/google/google-conversions.service';

const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');

describe('normalizePhoneForGoogle', () => {
  it('antepone el codigo de pais a numeros locales', () => {
    expect(normalizePhoneForGoogle('912345678')).toBe('+56912345678');
  });

  it('respeta numeros ya internacionales', () => {
    expect(normalizePhoneForGoogle('+56912345678')).toBe('+56912345678');
    expect(normalizePhoneForGoogle('56 9 1234 5678')).toBe('+56912345678');
  });

  it('devuelve vacio si no hay digitos', () => {
    expect(normalizePhoneForGoogle('sin-digitos')).toBe('');
  });
});

describe('formatConversionDateTime', () => {
  it('usa el formato exigido por Google con desplazamiento de zona', () => {
    // 2026-07-24T18:30:45Z en Santiago (UTC-4 en julio) = 14:30:45-04:00
    const result = formatConversionDateTime(new Date('2026-07-24T18:30:45Z'), 'America/Santiago');
    expect(result).toBe('2026-07-24 14:30:45-04:00');
  });

  it('funciona con UTC', () => {
    const result = formatConversionDateTime(new Date('2026-07-24T18:30:45Z'), 'UTC');
    expect(result).toBe('2026-07-24 18:30:45+00:00');
  });
});

describe('buildUserIdentifiers', () => {
  it('hashea email y telefono normalizado', () => {
    const identifiers = buildUserIdentifiers({ email: '  Test@Example.COM ', phone: '912345678' });
    expect(identifiers).toContainEqual({ hashedEmail: sha256('test@example.com') });
    expect(identifiers).toContainEqual({ hashedPhoneNumber: sha256('+56912345678') });
  });

  it('deja los campos geograficos sin hashear, a diferencia de Meta', () => {
    const identifiers = buildUserIdentifiers({
      firstName: 'Ana', lastName: 'Perez',
      country: 'cl', region: 'valparaiso', city: 'valparaiso',
    });
    const address = identifiers.find((item) => 'addressInfo' in item)?.addressInfo as Record<string, unknown>;
    expect(address.countryCode).toBe('CL');
    expect(address.state).toBe('valparaiso');
    expect(address.city).toBe('valparaiso');
    expect(address.hashedFirstName).toBe(sha256('ana'));
    expect(address.hashedLastName).toBe(sha256('perez'));
  });

  it('omite addressInfo cuando no hay ningun dato', () => {
    expect(buildUserIdentifiers({ email: 'a@b.com' })).toEqual([
      { hashedEmail: sha256('a@b.com') },
    ]);
  });

  it('devuelve vacio cuando no hay ningun identificador', () => {
    expect(buildUserIdentifiers({})).toEqual([]);
  });
});

describe('GoogleConversionsService.buildPayload', () => {
  const service = new GoogleConversionsService();
  const base = {
    conversionAction: 'customers/123/conversionActions/456',
    conversionDateTime: new Date('2026-07-24T18:30:45Z'),
    timezone: 'America/Santiago',
  };

  it('arma el payload con gclid', () => {
    const payload = service.buildPayload({ ...base, gclid: 'abc123', orderId: 'res-1', userData: {} });
    expect(payload).toMatchObject({
      conversionAction: 'customers/123/conversionActions/456',
      conversionDateTime: '2026-07-24 14:30:45-04:00',
      gclid: 'abc123',
      orderId: 'res-1',
    });
  });

  it('permite enhanced conversions sin gclid', () => {
    const payload = service.buildPayload({ ...base, userData: { email: 'a@b.com' } });
    expect(payload.gclid).toBeUndefined();
    expect(payload.userIdentifiers).toHaveLength(1);
  });

  it('rechaza conversiones sin identificador de clic ni de usuario', () => {
    expect(() => service.buildPayload({ ...base, userData: {} })).toThrow(
      /Se requiere un identificador de clic o al menos un identificador de usuario/,
    );
  });

  it('emite gbraid cuando no hay gclid, para el trafico iOS de Google', () => {
    const payload = service.buildPayload({ ...base, gbraid: 'gb-1', userData: {} });

    expect(payload.gbraid).toBe('gb-1');
    expect(payload.gclid).toBeUndefined();
  });

  it('emite un solo identificador de clic aunque lleguen varios', () => {
    // Google rechaza la conversion si recibe mas de uno, asi que se prefiere el mas preciso.
    const payload = service.buildPayload({ ...base, gclid: 'gc-1', gbraid: 'gb-1', wbraid: 'wb-1', userData: {} });

    expect(payload.gclid).toBe('gc-1');
    expect(payload.gbraid).toBeUndefined();
    expect(payload.wbraid).toBeUndefined();
  });

  it('incluye valor y moneda cuando se entregan', () => {
    const payload = service.buildPayload({
      ...base, gclid: 'abc', conversionValue: 25000, currencyCode: 'CLP', userData: {},
    });
    expect(payload).toMatchObject({ conversionValue: 25000, currencyCode: 'CLP' });
  });
});
