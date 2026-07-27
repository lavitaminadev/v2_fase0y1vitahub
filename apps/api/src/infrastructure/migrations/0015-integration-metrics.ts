import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class IntegrationMetrics1710000000015 implements MigrationInterface {
  name = 'IntegrationMetrics1710000000015';
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(new Table({ name: 'integration_metrics', columns: [
      { name: 'id', type: 'uuid', isPrimary: true, generationStrategy: 'uuid' },
      { name: 'organization_id', type: 'uuid' }, { name: 'client_id', type: 'uuid' },
      { name: 'provider', type: 'varchar', length: '30' }, { name: 'external_account_id', type: 'varchar', length: '255' },
      { name: 'metric_date', type: 'date' }, { name: 'spend', type: 'decimal', precision: 18, scale: 2, default: 0 },
      { name: 'impressions', type: 'bigint', default: 0 }, { name: 'reach', type: 'bigint', default: 0 },
      { name: 'clicks', type: 'bigint', default: 0 }, { name: 'conversions', type: 'decimal', precision: 18, scale: 4, default: 0 },
      { name: 'leads', type: 'decimal', precision: 18, scale: 4, default: 0 }, { name: 'breakdown', type: 'json', isNullable: true },
      { name: 'created_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' }, { name: 'updated_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
    ] }), true);
    await queryRunner.createIndex('integration_metrics', new TableIndex({ name: 'UQ_integration_metric_daily', columnNames: ['provider', 'external_account_id', 'client_id', 'metric_date'], isUnique: true }));
    await queryRunner.createIndex('integration_metrics', new TableIndex({ name: 'IDX_integration_metrics_org_client_date', columnNames: ['organization_id', 'client_id', 'metric_date'] }));
  }
  async down(queryRunner: QueryRunner): Promise<void> { await queryRunner.dropTable('integration_metrics'); }
}
