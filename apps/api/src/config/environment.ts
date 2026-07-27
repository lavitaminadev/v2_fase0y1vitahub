import { z } from 'zod';

const environmentSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  CORS_ORIGIN: z.string().min(1).default('http://localhost:5173'),
  DB_HOST: z.string().min(1).default('localhost'),
  DB_PORT: z.coerce.number().int().min(1).max(65535).default(3306),
  DB_USERNAME: z.string().min(1).default('vitahub'),
  DB_PASSWORD: z.string().min(1),
  DB_DATABASE: z.string().min(1).default('vitahub'),
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().regex(/^\d+[smhd]$/).default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().regex(/^\d+[smhd]$/).default('7d'),
  INTEGRATION_ENCRYPTION_KEY: z.string().min(32),
  OAUTH_STATE_SECRET: z.string().min(32),
  APP_PUBLIC_URL: z.string().url(),
  API_PUBLIC_URL: z.string().url(),
  VITE_API_URL: z.string().url(),
  UPLOAD_DIR: z.string().min(1),
  CONVERSATION_SERVICE_URL: z.preprocess((value) => value === '' ? undefined : value, z.string().url().optional()),
  INTERNAL_API_TOKEN: z.string().min(32).optional(),
  MAX_UPLOAD_BYTES: z.coerce.number().int().min(1024).max(100 * 1024 * 1024).default(20 * 1024 * 1024),
  CLOUDINARY_CLOUD_NAME: z.string().min(1).optional(),
  CLOUDINARY_API_KEY: z.string().min(1).optional(),
  CLOUDINARY_API_SECRET: z.string().min(1).optional(),
  CLOUDINARY_MAX_IMAGE_BYTES: z.coerce.number().int().min(1024).max(10 * 1024 * 1024).default(5 * 1024 * 1024),
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(10).default(1),
  SMTP_ENABLED: z.enum(['true', 'false']).default('false'),
  SMTP_HOST: z.string().min(1).optional(),
  SMTP_PORT: z.coerce.number().int().min(1).max(65535).optional(),
  SMTP_SECURE: z.enum(['true', 'false']).optional(),
  SMTP_USER: z.string().min(1).optional(),
  SMTP_PASSWORD: z.string().min(1).optional(),
  SMTP_FROM: z.string().email().optional(),
  SMTP_REPLY_TO: z.string().email().optional(),
});

export function validateEnvironment(environment: NodeJS.ProcessEnv = process.env): void {
  if (environment.NODE_ENV !== 'production') return;
  const result = environmentSchema.safeParse(environment);
  if (!result.success) {
    const fields = result.error.issues.map((issue) => issue.path.join('.')).join(', ');
    throw new Error(`Invalid production environment: ${fields}`);
  }
  const forbidden = ['vitahub_secret', 'vitahub_jwt_secret_change_in_prod', 'change_me'];
  for (const key of ['DB_PASSWORD', 'JWT_SECRET', 'INTEGRATION_ENCRYPTION_KEY', 'OAUTH_STATE_SECRET'] as const) {
    if (forbidden.some((value) => environment[key]?.includes(value))) throw new Error(`Unsafe production secret: ${key}`);
  }
  const encryptionKey = environment.INTEGRATION_ENCRYPTION_KEY!.trim();
  const encryptionBytes = /^[0-9a-f]{64}$/i.test(encryptionKey)
    ? Buffer.from(encryptionKey, 'hex')
    : Buffer.from(encryptionKey, 'base64');
  const validBase64 = encryptionBytes.toString('base64') === encryptionKey;
  if (encryptionBytes.length !== 32 || (!/^[0-9a-f]{64}$/i.test(encryptionKey) && !validBase64)) {
    throw new Error('INTEGRATION_ENCRYPTION_KEY must contain exactly 32 bytes (base64 or hex)');
  }
  for (const key of ['APP_PUBLIC_URL', 'API_PUBLIC_URL', 'VITE_API_URL'] as const) {
    const url = new URL(environment[key]!);
    if (url.protocol !== 'https:' || url.username || url.password) throw new Error(`Unsafe production URL: ${key}`);
  }
  const appUrl = new URL(environment.APP_PUBLIC_URL!);
  const apiUrl = new URL(environment.API_PUBLIC_URL!);
  const viteApiUrl = new URL(environment.VITE_API_URL!);
  if (appUrl.pathname !== '/' || appUrl.search || appUrl.hash) throw new Error('APP_PUBLIC_URL must be an origin without a path');
  if (apiUrl.pathname.replace(/\/$/, '') !== '/api' || apiUrl.search || apiUrl.hash) throw new Error('API_PUBLIC_URL must end in /api');
  if (viteApiUrl.href.replace(/\/$/, '') !== apiUrl.href.replace(/\/$/, '')) throw new Error('VITE_API_URL must match API_PUBLIC_URL');
  const origins = parseCorsOrigins(environment.CORS_ORIGIN);
  if (!origins.length || origins.includes('*')) throw new Error('Unsafe production CORS_ORIGIN');
  for (const origin of origins) {
    const url = new URL(origin);
    if (url.protocol !== 'https:' || url.origin !== origin) throw new Error('Unsafe production CORS_ORIGIN');
  }
  if (!origins.includes(appUrl.origin)) throw new Error('CORS_ORIGIN must include APP_PUBLIC_URL');
  const uploadDir = environment.UPLOAD_DIR!.replace(/\\/g, '/');
  if (!/^(?:\/|[A-Za-z]:\/)/.test(uploadDir) || /(^|\/)public_html(\/|$)/i.test(uploadDir)) {
    throw new Error('UPLOAD_DIR must be absolute and outside public_html');
  }
  if (environment.CONVERSATION_SERVICE_URL) {
    const serviceUrl = new URL(environment.CONVERSATION_SERVICE_URL);
    if (serviceUrl.protocol !== 'https:' || !environment.INTERNAL_API_TOKEN || environment.INTERNAL_API_TOKEN.length < 32) {
      throw new Error('Unsafe production conversation service configuration');
    }
  }
  if (environment.SMTP_ENABLED === 'true') {
    const required = ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASSWORD', 'SMTP_FROM'] as const;
    if (required.some((key) => !environment[key]?.trim())) throw new Error('Invalid production SMTP configuration');
  }
}

export function parseCorsOrigins(value = process.env.CORS_ORIGIN ?? 'http://localhost:5173'): string[] {
  return value.split(',').map((origin) => origin.trim().replace(/\/$/, '')).filter(Boolean);
}
