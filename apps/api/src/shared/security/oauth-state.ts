import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { BadRequestException } from '@nestjs/common';

interface OAuthStatePayload {
  provider: 'meta' | 'google';
  organizationId: string;
  redirectUri: string;
  expiresAt: number;
  nonce: string;
}

function stateSecret(): string {
  const secret = process.env.OAUTH_STATE_SECRET || process.env.JWT_SECRET;
  if (!secret) throw new Error('OAUTH_STATE_SECRET or JWT_SECRET is required');
  return secret;
}

export function createOAuthState(
  provider: OAuthStatePayload['provider'],
  organizationId: string,
  redirectUri: string,
): string {
  const payload: OAuthStatePayload = {
    provider,
    organizationId,
    redirectUri,
    expiresAt: Date.now() + 10 * 60 * 1000,
    nonce: randomBytes(16).toString('base64url'),
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = createHmac('sha256', stateSecret()).update(encoded).digest('base64url');
  return `${encoded}.${signature}`;
}

export function verifyOAuthState(
  state: string,
  expected: Pick<OAuthStatePayload, 'provider' | 'organizationId' | 'redirectUri'>,
): void {
  const [encoded, signature, ...extra] = state.split('.');
  if (!encoded || !signature || extra.length) throw new BadRequestException('Invalid OAuth state');
  const calculated = createHmac('sha256', stateSecret()).update(encoded).digest();
  const received = Buffer.from(signature, 'base64url');
  if (calculated.length !== received.length || !timingSafeEqual(calculated, received)) {
    throw new BadRequestException('Invalid OAuth state');
  }

  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as OAuthStatePayload;
    if (
      payload.expiresAt < Date.now()
      || payload.provider !== expected.provider
      || payload.organizationId !== expected.organizationId
      || payload.redirectUri !== expected.redirectUri
    ) {
      throw new Error('OAuth state mismatch');
    }
  } catch {
    throw new BadRequestException('Invalid OAuth state');
  }
}
