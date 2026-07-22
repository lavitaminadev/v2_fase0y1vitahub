import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { MetaOAuthService } from '../../../src/modules/integrations/meta/meta-oauth.service';
import { IntegrationStatus } from '../../../src/modules/integrations/integration-status.enum';
import { IntegrationProvider } from '../../../src/modules/integrations/integration-provider.enum';
import { IntegrationAccountType } from '../../../src/modules/integrations/integration-account-type.enum';
import { revealSecret } from '../../../src/shared/security/integration-secrets';

const integrationsRepo = {
  findOne: vi.fn(),
  create: vi.fn(),
  save: vi.fn(),
};

const accountsRepo = {
  find: vi.fn(),
  create: vi.fn(),
  save: vi.fn(),
};

const conversionOutboxRepo = { count: vi.fn() };
const leadEventsRepo = { count: vi.fn() };

describe('MetaOAuthService', () => {
  let service: MetaOAuthService;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    service = new MetaOAuthService(integrationsRepo as any, accountsRepo as any, conversionOutboxRepo as any, leadEventsRepo as any);
    process.env.META_APP_ID = 'meta-app';
    process.env.META_APP_SECRET = 'meta-secret';
    process.env.META_GRAPH_API_VERSION = 'v23.0';
    conversionOutboxRepo.count.mockResolvedValue(0);
    leadEventsRepo.count.mockResolvedValue(0);
  });

  it('includes messaging and lead retrieval scopes in the authorization url', () => {
    const url = service.getAuthorizationUrl('http://localhost/callback', 'signed-state');

    expect(url).toContain('instagram_manage_messages');
    expect(url).toContain('pages_manage_metadata');
    expect(url).not.toContain('pages_manage_ads');
    expect(url).not.toContain('ads_management');
    expect(url).toContain('leads_retrieval');
    expect(url).toContain('state=signed-state');
  });

  it('stores the integration after exchanging OAuth code and long-lived token', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            access_token: 'short-token',
            token_type: 'bearer',
            expires_in: 3600,
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            access_token: 'long-token',
            token_type: 'bearer',
            expires_in: 5184000,
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ id: 'meta-user-1' }),
        }),
    );

    integrationsRepo.findOne.mockResolvedValue(null);
    integrationsRepo.create.mockImplementation((data) => data);
    integrationsRepo.save.mockImplementation(async (data) => ({ id: 'int-1', ...data }));

    const result = await service.connectWithCode('org-1', 'code-123', 'http://localhost/callback');

    expect(result.status).toBe(IntegrationStatus.ACTIVE);
    const saved = integrationsRepo.save.mock.calls[0][0];
    expect(revealSecret(saved.config.accessToken)).toBe('long-token');
    expect(saved.config.metaUserId).toBe('meta-user-1');
    expect(saved.config.scopes).toEqual(
      expect.arrayContaining(['instagram_manage_messages', 'pages_manage_metadata', 'leads_retrieval']),
    );
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

  it('fails refresh when the integration has no access token', async () => {
    integrationsRepo.findOne.mockResolvedValue({
      id: 'int-1',
      organizationId: 'org-1',
      provider: IntegrationProvider.META,
      config: {},
    });

    await expect(service.refreshIntegration('int-1', 'org-1')).rejects.toThrow(BadRequestException);
  });

  it('removes stored account credentials when Meta is disconnected', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }));
    const integration = {
      id: 'int-1',
      organizationId: 'org-1',
      provider: IntegrationProvider.META,
      status: IntegrationStatus.ACTIVE,
      config: { accessToken: 'meta-token' },
      errorMessage: 'previous error',
    };
    const account = {
      id: 'account-1',
      integrationId: 'int-1',
      accountType: IntegrationAccountType.AD_ACCOUNT,
      accessToken: 'encrypted-access',
      refreshToken: 'encrypted-refresh',
      tokenExpiresAt: new Date(),
      metadata: { selected: true },
    };
    integrationsRepo.findOne.mockResolvedValue(integration);
    integrationsRepo.save.mockImplementation(async (data) => data);
    accountsRepo.find.mockResolvedValue([account]);
    accountsRepo.save.mockImplementation(async (data) => data);

    const result = await service.disconnectIntegration('int-1', 'org-1');

    expect(account).toMatchObject({
      accessToken: null,
      refreshToken: null,
      tokenExpiresAt: null,
      metadata: { selected: false },
    });
    expect(result).toMatchObject({ status: IntegrationStatus.DISABLED, config: {} });
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
