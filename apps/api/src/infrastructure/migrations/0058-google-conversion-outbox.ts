import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

/**
 * Cola de conversiones offline hacia Google Ads, espejo de
 * `meta_conversion_outbox` (migración 0014).
 */
export class GoogleConversionOutbox1724247500000 implements MigrationInterface {
  name = 'GoogleConversionOutbox1724247500000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(new Table({
      name: 'google_conversion_outbox',
      columns: [
        { name: 'id', type: 'varchar', length: '36', isPrimary: true, isGenerated: true, generationStrategy: 'uuid' },
        { name: 'organization_id', type: 'varchar', length: '36' },
        { name: 'event_id', type: 'varchar', length: '255' },
        { name: 'customer_id', type: 'varchar', length: '32' },
        { name: 'conversion_action', type: 'varchar', length: '255' },
        { name: 'conversion_data', type: 'json' },
        { name: 'status', type: 'varchar', length: '20', default: "'pending'" },
        { name: 'attempts', type: 'int', default: 0 },
        { name: 'next_attempt_at', type: 'timestamp', isNullable: true },
        { name: 'last_error', type: 'text', isNullable: true },
        { name: 'processed_at', type: 'timestamp', isNullable: true },
        { name: 'created_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
        { name: 'updated_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
      ],
    }), true);
    await queryRunner.createIndex('google_conversion_outbox', new TableIndex({ name: 'UQ_google_conversion_event', columnNames: ['organization_id', 'event_id'], isUnique: true }));
    await queryRunner.createIndex('google_conversion_outbox', new TableIndex({ name: 'IDX_google_conversion_outbox_pending', columnNames: ['status', 'next_attempt_at'] }));
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('google_conversion_outbox');
  }
}
