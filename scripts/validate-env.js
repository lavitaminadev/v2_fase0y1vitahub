// Valida variables de entorno críticas antes de deploy
const REQUIRED = [
  'NODE_ENV', 'PORT', 'CORS_ORIGIN', 'APP_PUBLIC_URL',
  'DB_HOST', 'DB_PORT', 'DB_USERNAME', 'DB_PASSWORD', 'DB_DATABASE',
  'JWT_SECRET', 'JWT_EXPIRES_IN',
  'INTEGRATION_ENCRYPTION_KEY', 'OAUTH_STATE_SECRET',
  'META_CONVERSIONS_ACCESS_TOKEN', 'API_PUBLIC_URL',
  'VITE_API_URL',
];
const MIN_LENGTH = { JWT_SECRET: 32, INTEGRATION_ENCRYPTION_KEY: 32, OAUTH_STATE_SECRET: 32, META_CONVERSIONS_ACCESS_TOKEN: 32, CRON_SECRET: 32 };

function loadEnv() {
  try { require('dotenv').config({ path: '.env' }); } catch {}
  try { require('dotenv').config({ path: '.env.override' }); } catch {}
}

function validate() {
  loadEnv();
  const missing = [];
  const tooShort = [];
  for (const key of REQUIRED) {
    if (!process.env[key]) missing.push(key);
  }
  for (const [key, min] of Object.entries(MIN_LENGTH)) {
    if (process.env[key] && process.env[key].length < min) tooShort.push(`${key} (min ${min} chars, got ${process.env[key].length})`);
  }
  if (missing.length) console.error(`❌ Missing required vars: ${missing.join(', ')}`);
  if (tooShort.length) console.error(`❌ Vars too short: ${tooShort.join(', ')}`);
  if (!missing.length && !tooShort.length) console.log('✅ All required environment variables are set.');
  process.exit(missing.length || tooShort.length ? 1 : 0);
}

validate();
