import { MigrationInterface, QueryRunner, Table, TableIndex, TableForeignKey } from 'typeorm';

export class CreateProduction1710000000005 implements MigrationInterface {
  name = 'CreateProduction1710000000005';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'pieces',
        columns: [
          { name: 'id', type: 'uuid', isPrimary: true, generationStrategy: 'uuid' },
          { name: 'organization_id', type: 'uuid' },
          { name: 'client_id', type: 'uuid' },
          { name: 'assigned_to', type: 'uuid', isNullable: true },
          { name: 'type', type: 'varchar', length: '50' },
          { name: 'title', type: 'varchar', length: '255' },
          { name: 'status', type: 'varchar', length: '50', default: "'backlog'" },
          { name: 'difficulty_level', type: 'tinyint', default: 1 },
          { name: 'ud_amount', type: 'decimal', precision: 8, scale: 2, default: 0 },
          { name: 'deadline_at', type: 'timestamp', isNullable: true },
          { name: 'delivered_at', type: 'timestamp', isNullable: true },
          { name: 'correction_count', type: 'int', default: 0 },
          { name: 'client_correction_count', type: 'int', default: 0 },
          { name: 'drive_link', type: 'varchar', length: '255', isNullable: true },
          { name: 'stale_alerted_at', type: 'timestamp', isNullable: true },
          { name: 'description', type: 'text', isNullable: true },
          { name: 'created_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
          { name: 'updated_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
        ],
      }),
      true,
    );

    await queryRunner.createTable(
      new Table({
        name: 'piece_versions',
        columns: [
          { name: 'id', type: 'uuid', isPrimary: true, generationStrategy: 'uuid' },
          { name: 'piece_id', type: 'uuid' },
          { name: 'version_number', type: 'int' },
          { name: 'file_name', type: 'varchar', length: '255' },
          { name: 'drive_file_id', type: 'varchar', length: '255', isNullable: true },
          { name: 'state_label', type: 'varchar', length: '50', isNullable: true },
          { name: 'is_final', type: 'boolean', default: false },
          { name: 'naming_valid', type: 'boolean', isNullable: true },
          { name: 'naming_errors', type: 'json', isNullable: true },
          { name: 'created_by', type: 'uuid', isNullable: true },
          { name: 'created_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
          { name: 'updated_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
        ],
      }),
      true,
    );

    await queryRunner.createTable(
      new Table({
        name: 'corrections',
        columns: [
          { name: 'id', type: 'uuid', isPrimary: true, generationStrategy: 'uuid' },
          { name: 'piece_id', type: 'uuid' },
          { name: 'piece_version_id', type: 'uuid', isNullable: true },
          { name: 'origin', type: 'varchar', length: '50' },
          { name: 'description', type: 'text' },
          { name: 'requested_by', type: 'uuid', isNullable: true },
          { name: 'resolved_by', type: 'uuid', isNullable: true },
          { name: 'resolved_at', type: 'timestamp', isNullable: true },
          { name: 'created_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
          { name: 'updated_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
        ],
      }),
      true,
    );

    await queryRunner.createTable(
      new Table({
        name: 'content_grids',
        columns: [
          { name: 'id', type: 'uuid', isPrimary: true, generationStrategy: 'uuid' },
          { name: 'organization_id', type: 'uuid' },
          { name: 'client_id', type: 'uuid' },
          { name: 'title', type: 'varchar', length: '255' },
          { name: 'week_start', type: 'date' },
          { name: 'week_end', type: 'date' },
          { name: 'status', type: 'varchar', length: '50', default: "'draft'" },
          { name: 'notes', type: 'text', isNullable: true },
          { name: 'created_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
          { name: 'updated_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
        ],
      }),
      true,
    );

    await queryRunner.createTable(
      new Table({
        name: 'content_items',
        columns: [
          { name: 'id', type: 'uuid', isPrimary: true, generationStrategy: 'uuid' },
          { name: 'content_grid_id', type: 'uuid' },
          { name: 'type', type: 'varchar', length: '50' },
          { name: 'caption', type: 'varchar', length: '255' },
          { name: 'status', type: 'varchar', length: '50', default: "'planned'" },
          { name: 'scheduled_at', type: 'date', isNullable: true },
          { name: 'piece_id', type: 'uuid', isNullable: true },
          { name: 'notes', type: 'text', isNullable: true },
          { name: 'created_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
          { name: 'updated_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'pieces',
      new TableIndex({ name: 'IDX_pieces_organization_id', columnNames: ['organization_id'] }),
    );
    await queryRunner.createIndex(
      'pieces',
      new TableIndex({ name: 'IDX_pieces_client_id', columnNames: ['client_id'] }),
    );
    await queryRunner.createIndex(
      'pieces',
      new TableIndex({ name: 'IDX_pieces_assigned_to', columnNames: ['assigned_to'] }),
    );
    await queryRunner.createIndex(
      'pieces',
      new TableIndex({ name: 'IDX_pieces_status', columnNames: ['status'] }),
    );
    await queryRunner.createIndex(
      'piece_versions',
      new TableIndex({ name: 'IDX_piece_versions_piece_id', columnNames: ['piece_id'] }),
    );
    await queryRunner.createIndex(
      'corrections',
      new TableIndex({ name: 'IDX_corrections_piece_id', columnNames: ['piece_id'] }),
    );
    await queryRunner.createIndex(
      'content_grids',
      new TableIndex({ name: 'IDX_content_grids_organization_id', columnNames: ['organization_id'] }),
    );
    await queryRunner.createIndex(
      'content_grids',
      new TableIndex({ name: 'IDX_content_grids_client_id', columnNames: ['client_id'] }),
    );
    await queryRunner.createIndex(
      'content_items',
      new TableIndex({ name: 'IDX_content_items_content_grid_id', columnNames: ['content_grid_id'] }),
    );

    await queryRunner.createForeignKey(
      'pieces',
      new TableForeignKey({ columnNames: ['organization_id'], referencedColumnNames: ['id'], referencedTableName: 'organizations', onDelete: 'CASCADE' }),
    );
    await queryRunner.createForeignKey(
      'pieces',
      new TableForeignKey({ columnNames: ['client_id'], referencedColumnNames: ['id'], referencedTableName: 'clients', onDelete: 'CASCADE' }),
    );
    await queryRunner.createForeignKey(
      'piece_versions',
      new TableForeignKey({ columnNames: ['piece_id'], referencedColumnNames: ['id'], referencedTableName: 'pieces', onDelete: 'CASCADE' }),
    );
    await queryRunner.createForeignKey(
      'corrections',
      new TableForeignKey({ columnNames: ['piece_id'], referencedColumnNames: ['id'], referencedTableName: 'pieces', onDelete: 'CASCADE' }),
    );
    await queryRunner.createForeignKey(
      'corrections',
      new TableForeignKey({ columnNames: ['piece_version_id'], referencedColumnNames: ['id'], referencedTableName: 'piece_versions', onDelete: 'SET NULL' }),
    );
    await queryRunner.createForeignKey(
      'content_grids',
      new TableForeignKey({ columnNames: ['organization_id'], referencedColumnNames: ['id'], referencedTableName: 'organizations', onDelete: 'CASCADE' }),
    );
    await queryRunner.createForeignKey(
      'content_grids',
      new TableForeignKey({ columnNames: ['client_id'], referencedColumnNames: ['id'], referencedTableName: 'clients', onDelete: 'CASCADE' }),
    );
    await queryRunner.createForeignKey(
      'content_items',
      new TableForeignKey({ columnNames: ['content_grid_id'], referencedColumnNames: ['id'], referencedTableName: 'content_grids', onDelete: 'CASCADE' }),
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('content_items');
    await queryRunner.dropTable('content_grids');
    await queryRunner.dropTable('corrections');
    await queryRunner.dropTable('piece_versions');
    await queryRunner.dropTable('pieces');
  }
}
