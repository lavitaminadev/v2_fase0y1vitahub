import { BadRequestException } from '@nestjs/common';
import { parseCorsOrigins } from '../../config/environment';

type OAuthProvider = 'meta' | 'google';

function configuredAppUrl(): string | undefined {
  return process.env.APP_PUBLIC_URL || process.env.NEXT_PUBLIC_APP_URL;
}

export function resolveOAuthRedirect(provider: OAuthProvider, requested?: string): string {
  const fallback = configuredAppUrl();
  const raw = requested || (fallback ? `${fallback.replace(/\/$/, '')}/integrations/${provider}/callback` : undefined);
  if (!raw) throw new BadRequestException('APP_PUBLIC_URL is required for OAuth');

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new BadRequestException('Invalid OAuth redirect URL');
  }

  const expectedPath = `/integrations/${provider}/callback`;
  if (url.pathname !== expectedPath || url.search || url.hash || url.username || url.password) {
    throw new BadRequestException('OAuth redirect URL is not allowed');
  }
  if (process.env.NODE_ENV === 'production' && url.protocol !== 'https:') {
    throw new BadRequestException('OAuth redirect URL must use HTTPS');
  }
  if (url.protocol === 'http:' && !['localhost', '127.0.0.1', '::1'].includes(url.hostname)) {
    throw new BadRequestException('OAuth redirect URL must use HTTPS');
  }

  const allowedOrigins = new Set(parseCorsOrigins());
  if (fallback) {
    try { allowedOrigins.add(new URL(fallback).origin); } catch { /* Production validation reports malformed configuration. */ }
  }
  if (!allowedOrigins.has(url.origin)) throw new BadRequestException('OAuth redirect origin is not allowed');
  return `${url.origin}${url.pathname}`;
}
