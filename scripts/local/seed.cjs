const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { config } = require('dotenv');
const { findMariaDbBinary, root } = require('./runtime.cjs');

config({ path: path.join(root, '.env'), quiet: true });
const client = findMariaDbBinary('mariadb');
const seed = path.join(root, 'database', 'seeds', 'seed.sql').replace(/\\/g, '/');
const result = spawnSync(client, [
  '--skip-ssl',
  '--abort-source-on-error',
  `--host=${process.env.DB_HOST || '127.0.0.1'}`,
  `--port=${process.env.DB_PORT || '3307'}`,
  `--user=${process.env.DB_USERNAME || 'vitahub'}`,
  `--password=${process.env.DB_PASSWORD || ''}`,
  `--database=${process.env.DB_DATABASE || 'vitahub'}`,
  `--execute=SOURCE ${seed}`,
], { cwd: root, stdio: 'inherit', windowsHide: true });

process.exit(result.status ?? 1);
