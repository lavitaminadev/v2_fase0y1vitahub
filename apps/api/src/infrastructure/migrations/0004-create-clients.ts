import { MigrationInterface, QueryRunner, Table, TableIndex, TableForeignKey } from 'typeorm';

export class CreateClients1710000000004 implements MigrationInterface {
  name = 'CreateClients1710000000004';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'clients',
        columns: [
          { name: 'id', type: 'uuid', isPrimary: true, generationStrategy: 'uuid' },
          { name: 'organization_id', type: 'uuid' },
          { name: 'lead_id', type: 'uuid', isNullable: true },
          { name: 'community_manager_id', type: 'uuid', isNullable: true },
          { name: 'name', type: 'varchar', length: '255' },
          { name: 'legal_name', type: 'varchar', length: '255', isNullable: true },
          { name: 'industry', type: 'varchar', length: '255', isNullable: true },
          { name: 'status', type: 'varchar', length: '50', default: "'onboarding'" },
          { name: 'retainer_amount', type: 'decimal', precision: 18, scale: 2, isNullable: true },
          { name: 'currency', type: 'char', length: '3', default: "'CLP'" },
          { name: 'started_at', type: 'date', isNullable: true },
          { name: 'renewal_at', type: 'date', isNullable: true },
          { name: 'whatsapp_group', type: 'varchar', length: '255', isNullable: true },
          { name: 'drive_folder_id', type: 'varchar', length: '255', isNullable: true },
          { name: 'default_ud_budget', type: 'decimal', precision: 8, scale: 2, default: 20 },
          { name: 'created_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
          { name: 'updated_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'clients',
      new TableIndex({ name: 'IDX_clients_organization_id', columnNames: ['organization_id'] }),
    );
    await queryRunner.createIndex(
      'clients',
      new TableIndex({ name: 'IDX_clients_community_manager_id', columnNames: ['community_manager_id'] }),
    );
    await queryRunner.createIndex(
      'clients',
      new TableIndex({ name: 'IDX_clients_status', columnNames: ['status'] }),
    );

    await queryRunner.createForeignKey(
      'clients',
      new TableForeignKey({
        columnNames: ['organization_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'organizations',
        onDelete: 'CASCADE',
      }),
    );
    await queryRunner.createForeignKey(
      'clients',
      new TableForeignKey({
        columnNames: ['lead_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'leads',
        onDelete: 'SET NULL',
      }),
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('clients');
  }
}
