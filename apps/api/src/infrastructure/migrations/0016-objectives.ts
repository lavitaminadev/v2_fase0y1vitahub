import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';
export class Objectives1710000000016 implements MigrationInterface {
  name = 'Objectives1710000000016';
  async up(queryRunner: QueryRunner): Promise<void> { await queryRunner.createTable(new Table({ name: 'objectives', columns: [
    { name: 'id', type: 'uuid', isPrimary: true, generationStrategy: 'uuid' }, { name: 'organization_id', type: 'uuid' },
    { name: 'owner_id', type: 'uuid', isNullable: true }, { name: 'client_id', type: 'uuid', isNullable: true }, { name: 'category', type: 'varchar', length: '30' },
    { name: 'title', type: 'varchar', length: '255' }, { name: 'description', type: 'text', isNullable: true }, { name: 'status', type: 'varchar', length: '20', default: "'active'" },
    { name: 'progress', type: 'tinyint', default: 0 }, { name: 'due_at', type: 'date', isNullable: true }, { name: 'created_by', type: 'uuid' },
    { name: 'created_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' }, { name: 'updated_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
  ] }), true); await queryRunner.createIndex('objectives', new TableIndex({ name: 'IDX_objectives_org_status', columnNames: ['organization_id', 'status'] })); }
  async down(queryRunner: QueryRunner): Promise<void> { await queryRunner.dropTable('objectives'); }
}
