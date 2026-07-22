import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { GoogleOAuthService } from '../../../src/modules/integrations/google/google-oauth.service';
import { IntegrationStatus } from '../../../src/modules/integrations/integration-status.enum';
import { revealSecret } from '../../../src/shared/security/integration-secrets';

const mockRepo = {
  findOne: vi.fn(),
  create: vi.fn(),
  save: vi.fn(),
};

describe('GoogleOAuthService', () => {
  let service: GoogleOAuthService;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    service = new GoogleOAuthService(mockRepo as any);
    process.env.GOOGLE_CLIENT_ID = 'google-client';
    process.env.GOOGLE_CLIENT_SECRET = 'google-secret';
  });

  it('stores the integration after exchanging an authorization code', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          access_token: 'access-token',
          refresh_token: 'refresh-token',
          expires_in: 3600,
          scope: 'scope-a',
          token_type: 'Bearer',
        }),
      }),
    );

    mockRepo.findOne.mockResolvedValue(null);
    mockRepo.create.mockImplementation((data) => data);
    mockRepo.save.mockImplementation(async (data) => ({ id: 'int-1', ...data }));

    const result = await service.connectWithCode('org-1', 'code-123', 'http://localhost/callback');

    expect(result.status).toBe(IntegrationStatus.ACTIVE);
    expect(mockRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 'org-1',
        provider: 'google',
        name: 'Google',
      }),
    );
    const saved = mockRepo.save.mock.calls[0][0];
    expect(revealSecret(saved.config.accessToken)).toBe('access-token');
    expect(revealSecret(saved.config.refreshToken)).toBe('refresh-token');
  });

  it('fails refresh when the stored integration has no refresh token', async () => {
    mockRepo.findOne.mockResolvedValue({
      id: 'int-1',
      organizationId: 'org-1',
      provider: 'google',
      config: {},
    });

    await expect(service.refreshIntegration('int-1', 'org-1')).rejects.toThrow(BadRequestException);
  });
});
