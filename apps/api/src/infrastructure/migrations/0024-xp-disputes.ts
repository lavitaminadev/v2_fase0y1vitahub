import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class XpDisputes1710000000024 implements MigrationInterface {
  name = 'XpDisputes1710000000024';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('xp_disputes')) return;
    await queryRunner.createTable(new Table({
      name: 'xp_disputes',
      columns: [
        { name: 'id', type: 'uuid', isPrimary: true, isGenerated: true, generationStrategy: 'uuid' },
        { name: 'organization_id', type: 'uuid' },
        { name: 'xp_period_id', type: 'uuid' },
        { name: 'user_id', type: 'uuid' },
        { name: 'message', type: 'text' },
        { name: 'status', type: 'varchar', length: '20', default: "'pending'" },
        { name: 'resolution', type: 'text', isNullable: true },
        { name: 'adjustment_points', type: 'int', default: 0 },
        { name: 'resolved_by', type: 'uuid', isNullable: true },
        { name: 'resolved_at', type: 'timestamp', isNullable: true },
        { name: 'created_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
        { name: 'updated_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' },
      ],
      foreignKeys: [
        { columnNames: ['organization_id'], referencedTableName: 'organizations', referencedColumnNames: ['id'], onDelete: 'CASCADE' },
        { columnNames: ['xp_period_id'], referencedTableName: 'xp_periods', referencedColumnNames: ['id'], onDelete: 'CASCADE' },
        { columnNames: ['user_id'], referencedTableName: 'users', referencedColumnNames: ['id'], onDelete: 'CASCADE' },
      ],
    }));
    await queryRunner.createIndex('xp_disputes', new TableIndex({ name: 'IDX_xp_disputes_org_status', columnNames: ['organization_id', 'status'] }));
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('xp_disputes')) await queryRunner.dropTable('xp_disputes');
  }
}
