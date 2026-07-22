import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class OperationalGovernance1710000000023 implements MigrationInterface {
  name = 'OperationalGovernance1710000000023';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasColumn('audit_logs', 'entity_id')) {
      const table = await queryRunner.getTable('audit_logs');
      const current = table?.findColumnByName('entity_id');
      if (current && !current.isNullable) await queryRunner.changeColumn('audit_logs', current, new TableColumn({ ...current, isNullable: true }));
    }
    if (!await queryRunner.hasColumn('pieces', 'assigned_at')) await queryRunner.addColumn('pieces', new TableColumn({ name: 'assigned_at', type: 'timestamp', isNullable: true }));
    if (!await queryRunner.hasColumn('pieces', 'started_at')) await queryRunner.addColumn('pieces', new TableColumn({ name: 'started_at', type: 'timestamp', isNullable: true }));
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasColumn('pieces', 'started_at')) await queryRunner.dropColumn('pieces', 'started_at');
    if (await queryRunner.hasColumn('pieces', 'assigned_at')) await queryRunner.dropColumn('pieces', 'assigned_at');
  }
}
