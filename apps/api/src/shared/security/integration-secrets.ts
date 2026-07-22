import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

const PREFIX = 'enc:v1';

function encryptionKey(): Buffer {
  const configured = process.env.INTEGRATION_ENCRYPTION_KEY?.trim();
  if (configured) {
    const decoded = /^[0-9a-f]{64}$/i.test(configured)
      ? Buffer.from(configured, 'hex')
      : Buffer.from(configured, 'base64');
    if (decoded.length !== 32) {
      throw new Error('INTEGRATION_ENCRYPTION_KEY must contain exactly 32 bytes (base64 or hex)');
    }
    return decoded;
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error('INTEGRATION_ENCRYPTION_KEY is required in production');
  }

  return createHash('sha256')
    .update(process.env.JWT_SECRET || 'vitahub-local-integration-key')
    .digest();
}

export function protectSecret(value: string): string {
  if (!value || value.startsWith(`${PREFIX}:`)) return value;
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [PREFIX, iv.toString('base64url'), tag.toString('base64url'), ciphertext.toString('base64url')].join(':');
}

export function revealSecret(value?: string | null): string | undefined {
  if (!value) return undefined;
  if (!value.startsWith(`${PREFIX}:`)) return value;

  const parts = value.split(':');
  if (parts.length !== 5) throw new Error('Encrypted integration secret has an invalid format');
  const [, , ivValue, tagValue, ciphertextValue] = parts;
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(ivValue, 'base64url'));
  decipher.setAuthTag(Buffer.from(tagValue, 'base64url'));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertextValue, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
}
