import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MetaClientPixelService } from '../../../src/modules/integrations/meta/meta-client-pixel.service';

describe('MetaClientPixelService', () => {
  const integrations = { findOne: vi.fn(), create: vi.fn((value) => value), save: vi.fn(async (value) => value) };
  const clients = { find: vi.fn(), findOne: vi.fn() };
  const pixels = { validatePixel: vi.fn() };
  let service: MetaClientPixelService;

  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.META_CONVERSIONS_ACCESS_TOKEN;
    service = new MetaClientPixelService(integrations as never, clients as never, pixels as never);
  });

  it('resolves only the Pixel and token explicitly assigned to the requested client', async () => {
    integrations.findOne.mockResolvedValue({
      config: { clientPixels: {
        'client-a': { pixelId: '111', pixelName: 'Pixel Principal', accessToken: 'token-a', configuredAt: '2026-07-20' },
        'client-b': { pixelId: '222', accessToken: 'token-b', configuredAt: '2026-07-20' },
      } },
    });
    await expect(service.resolve('org-1', 'client-a')).resolves.toEqual({ pixelId: '111', pixelName: 'Pixel Principal', accessToken: 'token-a' });
    await expect(service.resolve('org-1', 'client-missing')).resolves.toEqual({ pixelId: '', pixelName: null, accessToken: undefined });
  });

  it('validates ownership and Pixel before persisting a client mapping', async () => {
    const integration = { config: {} };
    integrations.findOne.mockResolvedValue(integration);
    clients.findOne.mockResolvedValue({ id: 'client-a', name: 'Cliente A' });
    pixels.validatePixel.mockResolvedValue(true);
    const result = await service.configure('integration-1', 'org-1', 'client-a', '123456', 'a-valid-access-token-for-meta', 'Reservas Cliente A');
    expect(result).toMatchObject({ clientId: 'client-a', pixelId: '123456', pixelName: 'Reservas Cliente A', tokenConfigured: true });
    expect(integration.config).toHaveProperty('clientPixels.client-a.pixelId', '123456');
    expect(integration.config).toHaveProperty('clientPixels.client-a.pixelName', 'Reservas Cliente A');
    expect(JSON.stringify(integration.config)).not.toContain('a-valid-access-token-for-meta');
  });

  it('configures a direct CAPI Pixel without requiring Meta OAuth', async () => {
    integrations.findOne.mockResolvedValue(null);
    clients.findOne.mockResolvedValue({ id: 'client-a', name: 'Cliente A' });
    pixels.validatePixel.mockResolvedValue(true);
    const result = await service.setup('org-1', 'client-a', 'manual', {
      pixelId: '123456',
      pixelName: 'Pixel Manual',
      accessToken: 'a-valid-access-token-for-meta',
    });
    expect(integrations.create).toHaveBeenCalledWith(expect.objectContaining({
      organizationId: 'org-1',
      name: 'Meta CAPI',
      status: 'pending',
    }));
    expect(result).toMatchObject({ clientId: 'client-a', pixelId: '123456', pixelName: 'Pixel Manual', tokenConfigured: true });
  });

  it('reuses an existing organization Pixel only after an explicit selection', async () => {
    const integration = { config: { clientPixels: {
      'client-a': { pixelId: '999', pixelName: 'Pixel Compartido', accessToken: 'protected-token', configuredAt: '2026-07-20' },
    } } };
    integrations.findOne.mockResolvedValue(integration);
    clients.findOne.mockResolvedValue({ id: 'client-b', name: 'Cliente B' });
    const result = await service.setup('org-1', 'client-b', 'existing', { existingPixelId: '999' });
    expect(result).toMatchObject({ clientId: 'client-b', pixelId: '999', pixelName: 'Pixel Compartido', tokenConfigured: true });
    expect(integration.config.clientPixels['client-b'].accessToken).toBe('protected-token');
    expect(integration.config.clientPixels['client-b'].pixelName).toBe('Pixel Compartido');
    expect(pixels.validatePixel).not.toHaveBeenCalled();
  });
});
