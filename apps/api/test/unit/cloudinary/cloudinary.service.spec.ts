import { beforeEach, describe, expect, it, vi } from 'vitest';
import { of } from 'rxjs';
import { CloudinaryService } from '../../../src/core/cloudinary/cloudinary.service';

/**
 * El aislamiento entre organizaciones en Cloudinary depende de la jerarquía de carpetas:
 * las credenciales pueden ser comunes a toda la instalación. Estas pruebas fijan que tanto
 * el listado como el borrado respeten esa frontera.
 */
function makeService(listResponse: unknown = { resources: [] }) {
  const http = {
    get: vi.fn().mockReturnValue(of({ data: listResponse })),
    post: vi.fn().mockReturnValue(of({ data: {} })),
  };
  // Sin integración propia, el servicio recurre a las credenciales de entorno, que son
  // comunes a todas las organizaciones.
  const integrations = { findOne: vi.fn().mockResolvedValue(null) };
  process.env.CLOUDINARY_CLOUD_NAME = 'demo';
  process.env.CLOUDINARY_API_KEY = 'key';
  process.env.CLOUDINARY_API_SECRET = 'secret';
  return { service: new CloudinaryService(integrations as never, http as never), http };
}

describe('CloudinaryService.folderFor', () => {
  it('anida el cliente dentro de la carpeta de la organización', () => {
    expect(CloudinaryService.folderFor('org-1')).toBe('vitahub/org-1');
    expect(CloudinaryService.folderFor('org-1', 'client-9')).toBe('vitahub/org-1/client-9');
  });
});

describe('CloudinaryService.listResources', () => {
  beforeEach(() => vi.clearAllMocks());

  it('acota el listado a la carpeta de la organización cuando no se pide un cliente', async () => {
    const { service, http } = makeService();
    await service.listResources('org-1');
    expect(http.get).toHaveBeenCalledWith(
      expect.stringContaining('/resources/image'),
      expect.objectContaining({ params: expect.objectContaining({ prefix: 'vitahub/org-1/' }) }),
    );
  });

  it('acota al cliente cuando se indica', async () => {
    const { service, http } = makeService();
    await service.listResources('org-1', { clientId: 'client-9' });
    expect(http.get).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ params: expect.objectContaining({ prefix: 'vitahub/org-1/client-9/' }) }),
    );
  });

  it('nunca consulta sin prefijo de carpeta', async () => {
    const { service, http } = makeService();
    await service.listResources('org-1');
    const params = http.get.mock.calls[0][1].params as Record<string, unknown>;
    expect(params.prefix).toBeTruthy();
  });
});

describe('CloudinaryService.destroy', () => {
  beforeEach(() => vi.clearAllMocks());

  it('elimina un recurso de la propia organización', async () => {
    const { service, http } = makeService();
    await service.destroy('vitahub/org-1/client-9/imagen', 'org-1');
    expect(http.post).toHaveBeenCalledTimes(1);
  });

  it('rechaza un recurso de otra organización sin llamar a Cloudinary', async () => {
    const { service, http } = makeService();
    await expect(service.destroy('vitahub/org-2/client-9/imagen', 'org-1'))
      .rejects.toThrow('no pertenece a esta organización');
    expect(http.post).not.toHaveBeenCalled();
  });

  it('rechaza un recurso fuera de la jerarquía de VitaHub', async () => {
    const { service, http } = makeService();
    await expect(service.destroy('otra-carpeta/imagen', 'org-1'))
      .rejects.toThrow('no pertenece a esta organización');
    expect(http.post).not.toHaveBeenCalled();
  });

  it('rechaza un identificador que solo comparte el prefijo del identificador de organización', async () => {
    const { service, http } = makeService();
    await expect(service.destroy('vitahub/org-10/client-9/imagen', 'org-1'))
      .rejects.toThrow('no pertenece a esta organización');
    expect(http.post).not.toHaveBeenCalled();
  });
});
