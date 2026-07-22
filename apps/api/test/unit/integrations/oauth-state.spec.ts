import { afterEach, describe, expect, it } from 'vitest';
import { createOAuthState, verifyOAuthState } from '../../../src/shared/security/oauth-state';

describe('OAuth state', () => {
  const originalSecret = process.env.OAUTH_STATE_SECRET;

  afterEach(() => {
    if (originalSecret === undefined) delete process.env.OAUTH_STATE_SECRET;
    else process.env.OAUTH_STATE_SECRET = originalSecret;
  });

  it('binds the callback to provider, organization and redirect URI', () => {
    process.env.OAUTH_STATE_SECRET = 'state-secret-with-enough-entropy';
    const state = createOAuthState('meta', 'org-1', 'https://app.example.com/integrations/meta/callback');

    expect(() => verifyOAuthState(state, {
      provider: 'meta',
      organizationId: 'org-1',
      redirectUri: 'https://app.example.com/integrations/meta/callback',
    })).not.toThrow();
    expect(() => verifyOAuthState(state, {
      provider: 'meta',
      organizationId: 'org-2',
      redirectUri: 'https://app.example.com/integrations/meta/callback',
    })).toThrow('Invalid OAuth state');
  });
});
