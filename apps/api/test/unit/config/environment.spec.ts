import { describe, expect, it } from 'vitest';
import { validateEnvironment } from '../../../src/config/environment';

const productionEnvironment: NodeJS.ProcessEnv = {
  NODE_ENV: 'production',
  PORT: '3000',
  CORS_ORIGIN: 'https://app.example.com',
  APP_PUBLIC_URL: 'https://app.example.com',
  API_PUBLIC_URL: 'https://api.example.com/api',
  VITE_API_URL: 'https://api.example.com/api',
  UPLOAD_DIR: '/home/account/vitahub_uploads',
  DB_HOST: 'localhost',
  DB_PORT: '3306',
  DB_USERNAME: 'vitahub',
  DB_PASSWORD: 'a-strong-database-password',
  DB_DATABASE: 'vitahub',
  JWT_SECRET: 'jwt-secret-with-at-least-thirty-two-characters',
  INTEGRATION_ENCRYPTION_KEY: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
  OAUTH_STATE_SECRET: 'oauth-state-secret-with-thirty-two-characters',
};

describe('validateEnvironment', () => {
  it('accepts secure public production URLs', () => {
    expect(() => validateEnvironment(productionEnvironment)).not.toThrow();
  });

  it('rejects non-HTTPS public URLs and wildcard CORS in production', () => {
    expect(() => validateEnvironment({ ...productionEnvironment, APP_PUBLIC_URL: 'http://app.example.com' })).toThrow('Unsafe production URL');
    expect(() => validateEnvironment({ ...productionEnvironment, CORS_ORIGIN: '*' })).toThrow('Unsafe production CORS_ORIGIN');
  });

  it('keeps the frontend API URL aligned and uploads outside public_html', () => {
    expect(() => validateEnvironment({
      ...productionEnvironment,
      VITE_API_URL: 'https://other.example.com/api',
    })).toThrow('VITE_API_URL must match API_PUBLIC_URL');
    expect(() => validateEnvironment({
      ...productionEnvironment,
      UPLOAD_DIR: '/home/account/public_html/uploads',
    })).toThrow('UPLOAD_DIR must be absolute and outside public_html');
  });

  it('requires an exact 32-byte integration encryption key', () => {
    expect(() => validateEnvironment({
      ...productionEnvironment,
      INTEGRATION_ENCRYPTION_KEY: 'this-value-is-long-but-not-a-valid-key',
    })).toThrow('INTEGRATION_ENCRYPTION_KEY must contain exactly 32 bytes');
  });

  it('requires HTTPS and an internal token for the optional conversation service', () => {
    expect(() => validateEnvironment({
      ...productionEnvironment,
      CONVERSATION_SERVICE_URL: 'http://messages.example.com',
      INTERNAL_API_TOKEN: 'short',
    })).toThrow();
  });

  it('rejects ambiguous JWT expiry values in production', () => {
    expect(() => validateEnvironment({
      ...productionEnvironment,
      JWT_EXPIRES_IN: '900',
    })).toThrow('Invalid production environment: JWT_EXPIRES_IN');
  });
});
