import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class CreateOrganizations1710000000001 implements MigrationInterface {
  name = 'CreateOrganizations1710000000001';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'organizations',
        columns: [
          { name: 'id', type: 'uuid', isPrimary: true, generationStrategy: 'uuid' },
          { name: 'name', type: 'varchar', length: '255' },
          { name: 'code', type: 'varchar', length: '50', isUnique: true },
          { name: 'logo_url', type: 'varchar', length: '255', isNullable: true },
          { name: 'currency', type: 'char', length: '3', default: "'CLP'" },
          { name: 'is_active', type: 'boolean', default: true },
          { name: 'created_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
          { name: 'updated_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'organizations',
      new TableIndex({ name: 'IDX_organizations_code', columnNames: ['code'] }),
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('organizations');
  }
}
