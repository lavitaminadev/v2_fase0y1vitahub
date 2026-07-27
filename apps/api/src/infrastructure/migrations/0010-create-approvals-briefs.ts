import { MigrationInterface, QueryRunner, Table, TableIndex, TableForeignKey } from 'typeorm';

export class CreateApprovalsBriefs1710000000010 implements MigrationInterface {
  name = 'CreateApprovalsBriefs1710000000010';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'approval_requests',
        columns: [
          { name: 'id', type: 'uuid', isPrimary: true, generationStrategy: 'uuid' },
          { name: 'organization_id', type: 'uuid' },
          { name: 'title', type: 'varchar', length: '255' },
          { name: 'description', type: 'text', isNullable: true },
          { name: 'entity_type', type: 'varchar', length: '100' },
          { name: 'entity_id', type: 'uuid' },
          { name: 'requested_by', type: 'uuid' },
          { name: 'assigned_to', type: 'uuid', isNullable: true },
          { name: 'status', type: 'varchar', length: '50', default: "'pending'" },
          { name: 'decision_at', type: 'timestamp', isNullable: true },
          { name: 'decision_notes', type: 'text', isNullable: true },
          { name: 'due_at', type: 'timestamp', isNullable: true },
          { name: 'created_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
          { name: 'updated_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
        ],
      }),
      true,
    );

    await queryRunner.createTable(
      new Table({
        name: 'approval_decisions',
        columns: [
          { name: 'id', type: 'uuid', isPrimary: true, generationStrategy: 'uuid' },
          { name: 'approval_request_id', type: 'uuid' },
          { name: 'decision', type: 'varchar', length: '50' },
          { name: 'comment', type: 'text', isNullable: true },
          { name: 'decided_by', type: 'uuid' },
          { name: 'created_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
        ],
      }),
      true,
    );

    await queryRunner.createTable(
      new Table({
        name: 'briefs',
        columns: [
          { name: 'id', type: 'uuid', isPrimary: true, generationStrategy: 'uuid' },
          { name: 'organization_id', type: 'uuid' },
          { name: 'client_id', type: 'uuid', isNullable: true },
          { name: 'title', type: 'varchar', length: '255' },
          { name: 'description', type: 'text', isNullable: true },
          { name: 'requirements', type: 'json', isNullable: true },
          { name: 'status', type: 'varchar', length: '20', default: "'draft'" },
          { name: 'due_date', type: 'date', isNullable: true },
          { name: 'created_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
          { name: 'updated_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
        ],
      }),
      true,
    );

    await queryRunner.createTable(
      new Table({
        name: 'contracts',
        columns: [
          { name: 'id', type: 'uuid', isPrimary: true, generationStrategy: 'uuid' },
          { name: 'organization_id', type: 'uuid' },
          { name: 'client_id', type: 'uuid', isNullable: true },
          { name: 'name', type: 'varchar', length: '255' },
          { name: 'service_type', type: 'varchar', length: '255', isNullable: true },
          { name: 'start_date', type: 'date' },
          { name: 'end_date', type: 'date', isNullable: true },
          { name: 'monthly_ud', type: 'decimal', precision: 8, scale: 2, default: 0 },
          { name: 'status', type: 'varchar', length: '20', default: "'active'" },
          { name: 'terms', type: 'text', isNullable: true },
          { name: 'created_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
          { name: 'updated_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
        ],
      }),
      true,
    );

    await queryRunner.createTable(
      new Table({
        name: 'onboarding',
        columns: [
          { name: 'id', type: 'uuid', isPrimary: true, generationStrategy: 'uuid' },
          { name: 'client_id', type: 'uuid' },
          { name: 'organization_id', type: 'uuid' },
          { name: 'step', type: 'varchar', length: '255' },
          { name: 'status', type: 'varchar', length: '20', default: "'pending'" },
          { name: 'assigned_to', type: 'uuid', isNullable: true },
          { name: 'completed_at', type: 'timestamp', isNullable: true },
          { name: 'notes', type: 'text', isNullable: true },
          { name: 'created_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
          { name: 'updated_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'approval_requests',
      new TableIndex({ name: 'IDX_approval_requests_organization_id', columnNames: ['organization_id'] }),
    );
    await queryRunner.createIndex(
      'approval_requests',
      new TableIndex({ name: 'IDX_approval_requests_entity', columnNames: ['entity_type', 'entity_id'] }),
    );
    await queryRunner.createIndex(
      'approval_decisions',
      new TableIndex({ name: 'IDX_approval_decisions_request_id', columnNames: ['approval_request_id'] }),
    );
    await queryRunner.createIndex(
      'briefs',
      new TableIndex({ name: 'IDX_briefs_organization_id', columnNames: ['organization_id'] }),
    );
    await queryRunner.createIndex(
      'contracts',
      new TableIndex({ name: 'IDX_contracts_organization_id', columnNames: ['organization_id'] }),
    );
    await queryRunner.createIndex(
      'onboarding',
      new TableIndex({ name: 'IDX_onboarding_client_id', columnNames: ['client_id'] }),
    );

    await queryRunner.createForeignKey(
      'approval_requests',
      new TableForeignKey({ columnNames: ['organization_id'], referencedColumnNames: ['id'], referencedTableName: 'organizations', onDelete: 'CASCADE' }),
    );
    await queryRunner.createForeignKey(
      'approval_decisions',
      new TableForeignKey({ columnNames: ['approval_request_id'], referencedColumnNames: ['id'], referencedTableName: 'approval_requests', onDelete: 'CASCADE' }),
    );
    await queryRunner.createForeignKey(
      'briefs',
      new TableForeignKey({ columnNames: ['organization_id'], referencedColumnNames: ['id'], referencedTableName: 'organizations', onDelete: 'CASCADE' }),
    );
    await queryRunner.createForeignKey(
      'contracts',
      new TableForeignKey({ columnNames: ['organization_id'], referencedColumnNames: ['id'], referencedTableName: 'organizations', onDelete: 'CASCADE' }),
    );
    await queryRunner.createForeignKey(
      'onboarding',
      new TableForeignKey({ columnNames: ['client_id'], referencedColumnNames: ['id'], referencedTableName: 'clients', onDelete: 'CASCADE' }),
    );
    await queryRunner.createForeignKey(
      'onboarding',
      new TableForeignKey({ columnNames: ['organization_id'], referencedColumnNames: ['id'], referencedTableName: 'organizations', onDelete: 'CASCADE' }),
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('onboarding');
    await queryRunner.dropTable('contracts');
    await queryRunner.dropTable('briefs');
    await queryRunner.dropTable('approval_decisions');
    await queryRunner.dropTable('approval_requests');
  }
}
