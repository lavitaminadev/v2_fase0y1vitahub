import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { createDeletionConfirmation, parseMetaSignedRequest, verifyDeletionConfirmation } from '../../../src/modules/integrations/meta/meta-data-deletion';

function base64Url(value: string | Buffer): string {
  return Buffer.from(value).toString('base64url');
}

describe('parseMetaSignedRequest', () => {
  it('accepts a valid HMAC-SHA256 request from Meta', () => {
    const payload = base64Url(JSON.stringify({ algorithm: 'HMAC-SHA256', user_id: 'meta-user-1' }));
    const signature = createHmac('sha256', 'app-secret').update(payload).digest();

    expect(parseMetaSignedRequest(`${base64Url(signature)}.${payload}`, 'app-secret')).toEqual({
      algorithm: 'HMAC-SHA256',
      user_id: 'meta-user-1',
    });
  });

  it('rejects a request with a forged signature', () => {
    const payload = base64Url(JSON.stringify({ algorithm: 'HMAC-SHA256', user_id: 'meta-user-1' }));

    expect(() => parseMetaSignedRequest(`${base64Url('forged')}.${payload}`, 'app-secret')).toThrow(
      'Invalid Meta signed request',
    );
  });

  it('creates a verifiable deletion status code and rejects tampering', () => {
    const code = createDeletionConfirmation('meta-user-1', 'app-secret');

    expect(verifyDeletionConfirmation(code, 'app-secret')).toMatchObject({ userId: 'meta-user-1' });
    expect(() => verifyDeletionConfirmation(`${code}x`, 'app-secret')).toThrow('Invalid deletion confirmation');
  });
});
