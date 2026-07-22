import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class ClientCapabilities1710000000032 implements MigrationInterface {
  name = 'ClientCapabilities1710000000032';

  async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasColumn('clients', 'capabilities'))) {
      await queryRunner.addColumn('clients', new TableColumn({
        name: 'capabilities',
        type: 'json',
        isNullable: true,
      }));
    }
    await queryRunner.query("UPDATE clients SET capabilities = JSON_OBJECT('reservations', true, 'crm', true, 'metaConversions', false) WHERE capabilities IS NULL");
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasColumn('clients', 'capabilities')) {
      await queryRunner.dropColumn('clients', 'capabilities');
    }
  }
}
