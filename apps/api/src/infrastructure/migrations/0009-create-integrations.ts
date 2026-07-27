import { MigrationInterface, QueryRunner, Table, TableIndex, TableForeignKey } from 'typeorm';

export class CreateIntegrations1710000000009 implements MigrationInterface {
  name = 'CreateIntegrations1710000000009';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'integrations',
        columns: [
          { name: 'id', type: 'uuid', isPrimary: true, generationStrategy: 'uuid' },
          { name: 'organization_id', type: 'uuid' },
          { name: 'provider', type: 'varchar', length: '50' },
          { name: 'name', type: 'varchar', length: '255' },
          { name: 'status', type: 'varchar', length: '50', default: "'pending'" },
          { name: 'config', type: 'json', isNullable: true },
          { name: 'error_message', type: 'text', isNullable: true },
          { name: 'last_sync_at', type: 'timestamp', isNullable: true },
          { name: 'created_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
          { name: 'updated_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
        ],
      }),
      true,
    );

    await queryRunner.createTable(
      new Table({
        name: 'integration_accounts',
        columns: [
          { name: 'id', type: 'uuid', isPrimary: true, generationStrategy: 'uuid' },
          { name: 'integration_id', type: 'uuid' },
          { name: 'account_type', type: 'varchar', length: '50' },
          { name: 'external_id', type: 'varchar', length: '255' },
          { name: 'external_name', type: 'varchar', length: '255' },
          { name: 'access_token', type: 'text', isNullable: true },
          { name: 'refresh_token', type: 'text', isNullable: true },
          { name: 'token_expires_at', type: 'timestamp', isNullable: true },
          { name: 'metadata', type: 'json', isNullable: true },
          { name: 'created_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
          { name: 'updated_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
        ],
      }),
      true,
    );

    await queryRunner.createTable(
      new Table({
        name: 'sync_runs',
        columns: [
          { name: 'id', type: 'uuid', isPrimary: true, generationStrategy: 'uuid' },
          { name: 'integration_account_id', type: 'uuid' },
          { name: 'status', type: 'varchar', length: '50', default: "'pending'" },
          { name: 'started_at', type: 'timestamp' },
          { name: 'completed_at', type: 'timestamp', isNullable: true },
          { name: 'error', type: 'text', isNullable: true },
          { name: 'created_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'integrations',
      new TableIndex({ name: 'IDX_integrations_organization_id', columnNames: ['organization_id'] }),
    );
    await queryRunner.createIndex(
      'integrations',
      new TableIndex({ name: 'IDX_integrations_provider', columnNames: ['provider'] }),
    );
    await queryRunner.createIndex(
      'integration_accounts',
      new TableIndex({ name: 'IDX_integration_accounts_integration_id', columnNames: ['integration_id'] }),
    );
    await queryRunner.createIndex(
      'sync_runs',
      new TableIndex({ name: 'IDX_sync_runs_integration_account_id', columnNames: ['integration_account_id'] }),
    );

    await queryRunner.createForeignKey(
      'integrations',
      new TableForeignKey({ columnNames: ['organization_id'], referencedColumnNames: ['id'], referencedTableName: 'organizations', onDelete: 'CASCADE' }),
    );
    await queryRunner.createForeignKey(
      'integration_accounts',
      new TableForeignKey({ columnNames: ['integration_id'], referencedColumnNames: ['id'], referencedTableName: 'integrations', onDelete: 'CASCADE' }),
    );
    await queryRunner.createForeignKey(
      'sync_runs',
      new TableForeignKey({ columnNames: ['integration_account_id'], referencedColumnNames: ['id'], referencedTableName: 'integration_accounts', onDelete: 'CASCADE' }),
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('sync_runs');
    await queryRunner.dropTable('integration_accounts');
    await queryRunner.dropTable('integrations');
  }
}
