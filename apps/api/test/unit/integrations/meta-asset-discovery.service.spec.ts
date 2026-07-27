import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { MetaAssetDiscoveryService } from '../../../src/modules/integrations/meta/meta-asset-discovery.service';
import { MetaIntegrationAccessor } from '../../../src/modules/integrations/meta/meta-integration-accessor.service';
import { IntegrationStatus } from '../../../src/modules/integrations/integration-status.enum';
import { IntegrationProvider } from '../../../src/modules/integrations/integration-provider.enum';
import { IntegrationAccountType } from '../../../src/modules/integrations/integration-account-type.enum';

const integrationsRepo = {
  findOne: vi.fn(),
  save: vi.fn(),
};

const accountsRepo = {
  find: vi.fn(),
  create: vi.fn(),
  save: vi.fn(),
};

describe('MetaAssetDiscoveryService', () => {
  let service: MetaAssetDiscoveryService;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    const accessor = new MetaIntegrationAccessor(integrationsRepo as any);
    service = new MetaAssetDiscoveryService(integrationsRepo as any, accountsRepo as any, accessor);
    process.env.META_GRAPH_API_VERSION = 'v23.0';
  });

  it('discovers assets and persists them by account type', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            data: [
              {
                id: 'page-1',
                name: 'La Vitamina Page',
                category: 'Marketing',
                access_token: 'page-token',
                connected_instagram_account: { id: 'ig-1', username: 'lvitamina' },
              },
            ],
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            data: [
              {
                id: 'act_1',
                name: 'Ads Main',
                account_status: 1,
                currency: 'CLP',
                timezone_name: 'America/Santiago',
              },
            ],
          }),
        }),
    );

    integrationsRepo.findOne.mockResolvedValue({
      id: 'int-1',
      organizationId: 'org-1',
      provider: IntegrationProvider.META,
      config: { accessToken: 'meta-token' },
      status: IntegrationStatus.ACTIVE,
    });

    accountsRepo.find
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          integrationId: 'int-1',
          accountType: IntegrationAccountType.PAGE,
          externalId: 'page-1',
          externalName: 'La Vitamina Page',
          metadata: { category: 'Marketing', selected: false },
        },
        {
          integrationId: 'int-1',
          accountType: IntegrationAccountType.PROFILE,
          externalId: 'ig-1',
          externalName: 'lvitamina',
          metadata: { pageId: 'page-1', selected: false },
        },
        {
          integrationId: 'int-1',
          accountType: IntegrationAccountType.AD_ACCOUNT,
          externalId: 'act_1',
          externalName: 'Ads Main',
          metadata: { currency: 'CLP', timezoneName: 'America/Santiago', selected: false },
        },
      ]);

    accountsRepo.create.mockImplementation((data) => data);
    accountsRepo.save.mockImplementation(async (data) => data);

    const result = await service.discoverAssets('int-1', 'org-1');

    expect(result.pages).toHaveLength(1);
    expect(result.instagramProfiles).toHaveLength(1);
    expect(result.adAccounts).toHaveLength(1);
    expect(accountsRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        accountType: IntegrationAccountType.PAGE,
        externalId: 'page-1',
      }),
    );
  });

  it('rejects assets that were not discovered for the integration', async () => {
    integrationsRepo.findOne.mockResolvedValue({
      id: 'int-1', organizationId: 'org-1', provider: IntegrationProvider.META, config: {},
    });
    accountsRepo.find.mockResolvedValue([]);

    await expect(service.saveSelectedAssets('int-1', 'org-1', { pageIds: ['unknown-page'] }))
      .rejects.toThrow(BadRequestException);
  });
});
