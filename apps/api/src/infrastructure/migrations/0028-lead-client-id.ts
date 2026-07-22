import { MigrationInterface, QueryRunner, TableColumn, TableIndex } from 'typeorm';

export class LeadClientId1710000000028 implements MigrationInterface {
  name = 'LeadClientId1710000000028';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!await queryRunner.hasColumn('leads', 'client_id')) {
      await queryRunner.addColumn('leads', new TableColumn({ name: 'client_id', type: 'uuid', isNullable: true }));
    }
    const table = await queryRunner.getTable('leads');
    if (table && !table.indices.some((index) => index.name === 'IDX_leads_client_id')) {
      await queryRunner.createIndex('leads', new TableIndex({ name: 'IDX_leads_client_id', columnNames: ['client_id'] }));
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('leads');
    if (table) {
      const index = table.indices.find((item) => item.name === 'IDX_leads_client_id');
      if (index) await queryRunner.dropIndex('leads', index);
    }
    if (await queryRunner.hasColumn('leads', 'client_id')) {
      await queryRunner.dropColumn('leads', 'client_id');
    }
  }
}
