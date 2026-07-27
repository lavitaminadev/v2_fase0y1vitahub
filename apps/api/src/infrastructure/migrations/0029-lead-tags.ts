import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class LeadTags1710000000029 implements MigrationInterface {
  name = 'LeadTags1710000000029';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!await queryRunner.hasColumn('leads', 'tags')) {
      await queryRunner.addColumn('leads', new TableColumn({ name: 'tags', type: 'json', isNullable: true }));
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasColumn('leads', 'tags')) {
      await queryRunner.dropColumn('leads', 'tags');
    }
  }
}
