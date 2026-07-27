import { afterEach, describe, expect, it } from 'vitest';
import { protectSecret, revealSecret } from '../../../src/shared/security/integration-secrets';

describe('integration secrets', () => {
  const originalKey = process.env.INTEGRATION_ENCRYPTION_KEY;

  afterEach(() => {
    if (originalKey === undefined) delete process.env.INTEGRATION_ENCRYPTION_KEY;
    else process.env.INTEGRATION_ENCRYPTION_KEY = originalKey;
  });

  it('encrypts a secret with authenticated encryption and decrypts it', () => {
    process.env.INTEGRATION_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString('base64');

    const encrypted = protectSecret('meta-token');

    expect(encrypted).not.toContain('meta-token');
    expect(encrypted).toMatch(/^enc:v1:/);
    expect(revealSecret(encrypted)).toBe('meta-token');
  });

  it('reads a legacy plaintext value so it can be rotated without downtime', () => {
    process.env.INTEGRATION_ENCRYPTION_KEY = Buffer.alloc(32, 9).toString('base64');

    expect(revealSecret('legacy-token')).toBe('legacy-token');
  });
});
