const path = require('node:path');

process.chdir(path.resolve(__dirname, '..'));
process.env.NODE_ENV = process.env.NODE_ENV || 'production';

async function main() {
  const dataSourceModule = require('../apps/api/dist/infrastructure/database-data-source.js');
  const dataSource = dataSourceModule.default ?? dataSourceModule;

  await dataSource.initialize();

  try {
    const results = await dataSource.runMigrations();
    console.log(`Applied migrations: ${results.length}`);
    for (const migration of results) {
      console.log(`- ${migration.name}`);
    }
  } finally {
    await dataSource.destroy();
  }
}

main().catch((error) => {
  console.error('Failed to run compiled migrations');
  console.error(error);
  process.exit(1);
});
