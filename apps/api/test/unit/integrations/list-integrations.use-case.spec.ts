import { describe, expect, it, vi } from 'vitest';
import { ListIntegrationsUseCase } from '../../../src/modules/integrations/list-integrations.use-case';

describe('ListIntegrationsUseCase', () => {
  it('never exposes integration credentials in API responses', async () => {
    const repo = {
      find: vi.fn().mockResolvedValue([
        {
          id: 'int-1',
          provider: 'meta',
          config: {
            accessToken: 'enc:v1:secret',
            refreshToken: 'refresh-secret',
            selectedPageIds: ['page-1'],
          },
        },
      ]),
    };
    const service = new ListIntegrationsUseCase(repo as any);

    const [integration] = await service.execute('org-1');

    expect(integration.config).toEqual({ selectedPageIds: ['page-1'] });
  });
});
