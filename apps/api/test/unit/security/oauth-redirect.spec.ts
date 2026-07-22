import { afterEach, describe, expect, it, vi } from 'vitest';
import { resolveOAuthRedirect } from '../../../src/shared/security/oauth-redirect';

describe('resolveOAuthRedirect', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('accepts the exact HTTPS callback on an allowed production origin', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('APP_PUBLIC_URL', 'https://app.example.com');
    vi.stubEnv('CORS_ORIGIN', 'https://app.example.com');

    expect(resolveOAuthRedirect('meta', 'https://app.example.com/integrations/meta/callback'))
      .toBe('https://app.example.com/integrations/meta/callback');
  });

  it('rejects HTTP, foreign origins and callback paths for another provider', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('APP_PUBLIC_URL', 'https://app.example.com');
    vi.stubEnv('CORS_ORIGIN', 'https://app.example.com');

    expect(() => resolveOAuthRedirect('meta', 'http://app.example.com/integrations/meta/callback')).toThrow();
    expect(() => resolveOAuthRedirect('meta', 'https://evil.example.com/integrations/meta/callback')).toThrow();
    expect(() => resolveOAuthRedirect('meta', 'https://app.example.com/integrations/google/callback')).toThrow();
  });

  it('allows local HTTP only during development', () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('APP_PUBLIC_URL', 'http://localhost:5173');
    vi.stubEnv('CORS_ORIGIN', 'http://localhost:5173');

    expect(resolveOAuthRedirect('google')).toBe('http://localhost:5173/integrations/google/callback');
  });
});
