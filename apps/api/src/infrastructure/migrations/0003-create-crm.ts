import { MigrationInterface, QueryRunner, Table, TableIndex, TableForeignKey } from 'typeorm';

export class CreateCrm1710000000003 implements MigrationInterface {
  name = 'CreateCrm1710000000003';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'leads',
        columns: [
          { name: 'id', type: 'uuid', isPrimary: true, generationStrategy: 'uuid' },
          { name: 'organization_id', type: 'uuid' },
          { name: 'name', type: 'varchar', length: '255' },
          { name: 'email', type: 'varchar', length: '255', isNullable: true },
          { name: 'phone', type: 'varchar', length: '20', isNullable: true },
          { name: 'company', type: 'varchar', length: '255', isNullable: true },
          { name: 'source', type: 'varchar', length: '255', isNullable: true },
          { name: 'status', type: 'varchar', length: '50', default: "'new'" },
          { name: 'assigned_to', type: 'uuid', isNullable: true },
          { name: 'notes', type: 'text', isNullable: true },
          { name: 'converted_at', type: 'timestamp', isNullable: true },
          { name: 'converted_to_client_id', type: 'uuid', isNullable: true },
          { name: 'created_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
          { name: 'updated_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
        ],
      }),
      true,
    );

    await queryRunner.createTable(
      new Table({
        name: 'lead_interactions',
        columns: [
          { name: 'id', type: 'uuid', isPrimary: true, generationStrategy: 'uuid' },
          { name: 'lead_id', type: 'uuid' },
          { name: 'type', type: 'varchar', length: '50' },
          { name: 'description', type: 'text', isNullable: true },
          { name: 'created_by', type: 'uuid', isNullable: true },
          { name: 'created_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'leads',
      new TableIndex({ name: 'IDX_leads_organization_id', columnNames: ['organization_id'] }),
    );
    await queryRunner.createIndex(
      'leads',
      new TableIndex({ name: 'IDX_leads_assigned_to', columnNames: ['assigned_to'] }),
    );
    await queryRunner.createIndex(
      'leads',
      new TableIndex({ name: 'IDX_leads_status', columnNames: ['status'] }),
    );
    await queryRunner.createIndex(
      'lead_interactions',
      new TableIndex({ name: 'IDX_lead_interactions_lead_id', columnNames: ['lead_id'] }),
    );

    await queryRunner.createForeignKey(
      'leads',
      new TableForeignKey({
        columnNames: ['organization_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'organizations',
        onDelete: 'CASCADE',
      }),
    );
    await queryRunner.createForeignKey(
      'lead_interactions',
      new TableForeignKey({
        columnNames: ['lead_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'leads',
        onDelete: 'CASCADE',
      }),
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('lead_interactions');
    await queryRunner.dropTable('leads');
  }
}
