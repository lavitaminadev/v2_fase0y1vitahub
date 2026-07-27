import { createHmac, timingSafeEqual } from 'node:crypto';
import { UnauthorizedException } from '@nestjs/common';

export interface MetaSignedRequestPayload {
  algorithm: string;
  user_id: string;
  issued_at?: number;
}

interface DeletionConfirmationPayload {
  userId: string;
  completedAt: string;
}

export function parseMetaSignedRequest(signedRequest: string, appSecret: string): MetaSignedRequestPayload {
  const [encodedSignature, encodedPayload, ...extra] = signedRequest.split('.');
  if (!encodedSignature || !encodedPayload || extra.length > 0) {
    throw new UnauthorizedException('Invalid Meta signed request');
  }

  const expected = createHmac('sha256', appSecret).update(encodedPayload).digest();
  const received = Buffer.from(encodedSignature, 'base64url');
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) {
    throw new UnauthorizedException('Invalid Meta signed request');
  }

  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8')) as MetaSignedRequestPayload;
    if (payload.algorithm?.toUpperCase() !== 'HMAC-SHA256' || !payload.user_id) {
      throw new Error('Invalid payload');
    }
    return payload;
  } catch {
    throw new UnauthorizedException('Invalid Meta signed request');
  }
}

export function createDeletionConfirmation(userId: string, appSecret: string): string {
  const payload: DeletionConfirmationPayload = { userId, completedAt: new Date().toISOString() };
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = createHmac('sha256', appSecret).update(encoded).digest('base64url');
  return `${encoded}.${signature}`;
}

export function verifyDeletionConfirmation(code: string, appSecret: string): DeletionConfirmationPayload {
  const [encoded, signature, ...extra] = code.split('.');
  if (!encoded || !signature || extra.length) throw new UnauthorizedException('Invalid deletion confirmation');
  const expected = createHmac('sha256', appSecret).update(encoded).digest();
  const received = Buffer.from(signature, 'base64url');
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) {
    throw new UnauthorizedException('Invalid deletion confirmation');
  }
  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as DeletionConfirmationPayload;
    if (!payload.userId || !payload.completedAt || Number.isNaN(Date.parse(payload.completedAt))) throw new Error('Invalid payload');
    return payload;
  } catch {
    throw new UnauthorizedException('Invalid deletion confirmation');
  }
}
