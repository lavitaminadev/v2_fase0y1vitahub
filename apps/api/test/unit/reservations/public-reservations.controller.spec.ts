import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PublicReservationsController } from '../../../src/modules/reservations/public-reservations.controller';

/**
 * `eventSourceUrl` es lo que se declara a Meta como origen de la conversión, y llega por un
 * endpoint sin autenticar. Estas pruebas fijan que la arma el servidor.
 */
describe('PublicReservationsController — eventSourceUrl', () => {
  const originalUrl = process.env.APP_PUBLIC_URL;
  let service: { createPublic: ReturnType<typeof vi.fn>; createPublicSurveyResponse: ReturnType<typeof vi.fn> };
  let controller: PublicReservationsController;

  beforeEach(() => {
    process.env.APP_PUBLIC_URL = 'https://reservas.lavitamina.cl';
    service = { createPublic: vi.fn().mockResolvedValue({ id: 'res-1' }), createPublicSurveyResponse: vi.fn() };
    controller = new PublicReservationsController(service as never);
  });

  afterEach(() => {
    if (originalUrl === undefined) delete process.env.APP_PUBLIC_URL;
    else process.env.APP_PUBLIC_URL = originalUrl;
  });

  /** Última URL con la que el controlador llamó al servicio. */
  function sentUrl(): string | undefined {
    return service.createPublic.mock.calls[0]?.[4];
  }

  async function create(eventSourceUrl?: string) {
    await controller.create('mi-local', { eventSourceUrl } as never, '1.2.3.4', 'agent');
  }

  it('descarta un dominio ajeno y usa la URL del servidor', async () => {
    // Sin esto, cualquiera podía declarar un dominio que no está verificado para ese Pixel:
    // Meta degrada o descarta la atribución de esas conversiones.
    await create('https://sitio-ajeno.com/book/mi-local');

    expect(sentUrl()).toBe('https://reservas.lavitamina.cl/book/mi-local');
  });

  it('descarta un valor que no es una URL', async () => {
    await create('no-soy-una-url');

    expect(sentUrl()).toBe('https://reservas.lavitamina.cl/book/mi-local');
  });

  it('conserva la URL del cliente cuando es del mismo host, con sus parámetros de campaña', async () => {
    const propia = 'https://reservas.lavitamina.cl/book/mi-local?utm_source=meta&gclid=abc';

    await create(propia);

    expect(sentUrl()).toBe(propia);
  });

  it('arma la URL del servidor cuando el cliente no envía ninguna', async () => {
    await create(undefined);

    expect(sentUrl()).toBe('https://reservas.lavitamina.cl/book/mi-local');
  });

  it('escapa el slug al construir la URL', async () => {
    await controller.create('mi local/../otro', {} as never, '1.2.3.4', 'agent');

    expect(sentUrl()).toBe('https://reservas.lavitamina.cl/book/mi%20local%2F..%2Fotro');
  });
});
