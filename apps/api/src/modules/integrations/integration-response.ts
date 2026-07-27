import { Integration } from './integration.entity';
import { IntegrationAccount } from './integration-account.entity';
import { BadRequestException } from '@nestjs/common';

const SECRET_CONFIG_KEYS = new Set([
  'accessToken',
  'refreshToken',
  'clientSecret',
  'apiKey',
  'token',
]);

function isSecretKey(key: string): boolean {
  const normalized = key.replace(/[_-]/g, '').toLowerCase();
  return SECRET_CONFIG_KEYS.has(key) || ['accesstoken', 'refreshtoken', 'clientsecret', 'apikey', 'password', 'privatekey', 'token'].includes(normalized);
}

function sanitizeValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitizeValue);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([key]) => !isSecretKey(key))
      .map(([key, nested]) => [key, sanitizeValue(nested)]),
  );
}

export function toIntegrationResponse(integration: Integration): Integration {
  const config = sanitizeValue(integration.config ?? {}) as Record<string, unknown>;
  return { ...integration, config };
}

export function toIntegrationAccountResponse(account: IntegrationAccount) {
  const { accessToken: _accessToken, refreshToken: _refreshToken, ...safe } = account;
  return safe;
}

export function assertConfigHasNoSecrets(config?: Record<string, unknown>): void {
  if (!config) return;
  const secretKey = Object.keys(config).find(isSecretKey);
  if (secretKey) {
    throw new BadRequestException(`Integration secret '${secretKey}' must be configured through its OAuth flow`);
  }
}
