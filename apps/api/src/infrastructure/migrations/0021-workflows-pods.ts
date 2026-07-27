import { MigrationInterface, QueryRunner, Table, TableColumn, TableForeignKey, TableIndex } from 'typeorm';

export class WorkflowsPods1710000000021 implements MigrationInterface {
  name = 'WorkflowsPods1710000000021';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!await queryRunner.hasTable('workflow_templates')) {
      await queryRunner.createTable(new Table({
        name: 'workflow_templates',
        columns: [
          { name: 'id', type: 'uuid', isPrimary: true, generationStrategy: 'uuid', isGenerated: true },
          { name: 'organization_id', type: 'uuid' },
          { name: 'code', type: 'varchar', length: '50' },
          { name: 'name', type: 'varchar', length: '150' },
          { name: 'description', type: 'text', isNullable: true },
          { name: 'steps', type: 'json' },
          { name: 'is_active', type: 'boolean', default: true },
          { name: 'version', type: 'int', default: 1 },
          { name: 'created_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
          { name: 'updated_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' },
        ],
        foreignKeys: [new TableForeignKey({ columnNames: ['organization_id'], referencedTableName: 'organizations', referencedColumnNames: ['id'], onDelete: 'CASCADE' })],
        indices: [new TableIndex({ name: 'UQ_workflow_templates_org_code', columnNames: ['organization_id', 'code'], isUnique: true })],
      }));
    }

    if (!await queryRunner.hasTable('pods')) {
      await queryRunner.createTable(new Table({
        name: 'pods',
        columns: [
          { name: 'id', type: 'uuid', isPrimary: true, generationStrategy: 'uuid', isGenerated: true },
          { name: 'organization_id', type: 'uuid' },
          { name: 'name', type: 'varchar', length: '150' },
          { name: 'leader_id', type: 'uuid', isNullable: true },
          { name: 'status', type: 'varchar', length: '20', default: "'active'" },
          { name: 'monthly_capacity_ud', type: 'decimal', precision: 10, scale: 2, default: 80 },
          { name: 'description', type: 'text', isNullable: true },
          { name: 'created_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
          { name: 'updated_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' },
        ],
        foreignKeys: [
          new TableForeignKey({ columnNames: ['organization_id'], referencedTableName: 'organizations', referencedColumnNames: ['id'], onDelete: 'CASCADE' }),
          new TableForeignKey({ columnNames: ['leader_id'], referencedTableName: 'users', referencedColumnNames: ['id'], onDelete: 'SET NULL' }),
        ],
        indices: [new TableIndex({ name: 'UQ_pods_org_name', columnNames: ['organization_id', 'name'], isUnique: true })],
      }));
    }

    if (!await queryRunner.hasTable('pod_members')) {
      await queryRunner.createTable(new Table({
        name: 'pod_members',
        columns: [
          { name: 'id', type: 'uuid', isPrimary: true, generationStrategy: 'uuid', isGenerated: true },
          { name: 'pod_id', type: 'uuid' },
          { name: 'user_id', type: 'uuid' },
          { name: 'created_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
        ],
        foreignKeys: [
          new TableForeignKey({ columnNames: ['pod_id'], referencedTableName: 'pods', referencedColumnNames: ['id'], onDelete: 'CASCADE' }),
          new TableForeignKey({ columnNames: ['user_id'], referencedTableName: 'users', referencedColumnNames: ['id'], onDelete: 'CASCADE' }),
        ],
        indices: [new TableIndex({ name: 'UQ_pod_members_pair', columnNames: ['pod_id', 'user_id'], isUnique: true })],
      }));
    }

    if (!await queryRunner.hasColumn('clients', 'pod_id')) {
      await queryRunner.addColumn('clients', new TableColumn({ name: 'pod_id', type: 'uuid', isNullable: true }));
      await queryRunner.createForeignKey('clients', new TableForeignKey({ name: 'FK_clients_pod', columnNames: ['pod_id'], referencedTableName: 'pods', referencedColumnNames: ['id'], onDelete: 'SET NULL' }));
    }
    if (!await queryRunner.hasColumn('users', 'weekly_capacity_ud')) {
      await queryRunner.addColumn('users', new TableColumn({ name: 'weekly_capacity_ud', type: 'decimal', precision: 8, scale: 2, default: 20 }));
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasColumn('users', 'weekly_capacity_ud')) await queryRunner.dropColumn('users', 'weekly_capacity_ud');
    if (await queryRunner.hasColumn('clients', 'pod_id')) {
      const table = await queryRunner.getTable('clients');
      const foreignKey = table?.foreignKeys.find((key) => key.columnNames.includes('pod_id'));
      if (foreignKey) await queryRunner.dropForeignKey('clients', foreignKey);
      await queryRunner.dropColumn('clients', 'pod_id');
    }
    for (const table of ['pod_members', 'pods', 'workflow_templates']) if (await queryRunner.hasTable(table)) await queryRunner.dropTable(table);
  }
}
