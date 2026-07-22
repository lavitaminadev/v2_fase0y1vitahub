import { MigrationInterface, QueryRunner, Table, TableIndex, TableForeignKey } from 'typeorm';

export class CreateParametersAudit1710000000011 implements MigrationInterface {
  name = 'CreateParametersAudit1710000000011';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'parameter_definitions',
        columns: [
          { name: 'id', type: 'uuid', isPrimary: true, generationStrategy: 'uuid' },
          { name: 'key', type: 'varchar', length: '100', isUnique: true },
          { name: 'description', type: 'text', isNullable: true },
          { name: 'default_value', type: 'json', isNullable: true },
          { name: 'created_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
          { name: 'updated_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
        ],
      }),
      true,
    );

    await queryRunner.createTable(
      new Table({
        name: 'parameter_values',
        columns: [
          { name: 'id', type: 'uuid', isPrimary: true, generationStrategy: 'uuid' },
          { name: 'definition_id', type: 'uuid' },
          { name: 'scope_type', type: 'varchar', length: '50' },
          { name: 'scope_id', type: 'uuid' },
          { name: 'value_json', type: 'json' },
          { name: 'version', type: 'int', default: 1 },
          { name: 'valid_from', type: 'datetime', default: 'CURRENT_TIMESTAMP' },
          { name: 'valid_to', type: 'datetime', isNullable: true },
          { name: 'created_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
          { name: 'updated_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
        ],
      }),
      true,
    );

    await queryRunner.createTable(
      new Table({
        name: 'audit_logs',
        columns: [
          { name: 'id', type: 'uuid', isPrimary: true, generationStrategy: 'uuid' },
          { name: 'organization_id', type: 'uuid' },
          { name: 'actor_id', type: 'uuid', isNullable: true },
          { name: 'entity_type', type: 'varchar', length: '100' },
          { name: 'entity_id', type: 'uuid' },
          { name: 'action', type: 'varchar', length: '50' },
          { name: 'before', type: 'json', isNullable: true },
          { name: 'after', type: 'json', isNullable: true },
          { name: 'reason', type: 'text', isNullable: true },
          { name: 'ip_address', type: 'varchar', length: '45', isNullable: true },
          { name: 'occurred_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
        ],
      }),
      true,
    );

    await queryRunner.createTable(
      new Table({
        name: 'refresh_tokens',
        columns: [
          { name: 'id', type: 'uuid', isPrimary: true, generationStrategy: 'uuid' },
          { name: 'user_id', type: 'uuid' },
          { name: 'token', type: 'text' },
          { name: 'expires_at', type: 'timestamp' },
          { name: 'created_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'parameter_definitions',
      new TableIndex({ name: 'IDX_parameter_definitions_key', columnNames: ['key'] }),
    );
    await queryRunner.createIndex(
      'parameter_values',
      new TableIndex({ name: 'IDX_parameter_values_definition_id', columnNames: ['definition_id'] }),
    );
    await queryRunner.createIndex(
      'parameter_values',
      new TableIndex({ name: 'IDX_parameter_values_scope', columnNames: ['scope_type', 'scope_id'] }),
    );
    await queryRunner.createIndex(
      'audit_logs',
      new TableIndex({ name: 'IDX_audit_logs_organization_id', columnNames: ['organization_id'] }),
    );
    await queryRunner.createIndex(
      'audit_logs',
      new TableIndex({ name: 'IDX_audit_logs_entity', columnNames: ['entity_type', 'entity_id'] }),
    );
    await queryRunner.createIndex(
      'audit_logs',
      new TableIndex({ name: 'IDX_audit_logs_action', columnNames: ['action'] }),
    );
    await queryRunner.createIndex(
      'refresh_tokens',
      new TableIndex({ name: 'IDX_refresh_tokens_user_id', columnNames: ['user_id'] }),
    );
    await queryRunner.createIndex(
      'refresh_tokens',
      new TableIndex({ name: 'IDX_refresh_tokens_token', columnNames: ['token'] }),
    );

    await queryRunner.createForeignKey(
      'parameter_values',
      new TableForeignKey({ columnNames: ['definition_id'], referencedColumnNames: ['id'], referencedTableName: 'parameter_definitions', onDelete: 'CASCADE' }),
    );
    await queryRunner.createForeignKey(
      'refresh_tokens',
      new TableForeignKey({ columnNames: ['user_id'], referencedColumnNames: ['id'], referencedTableName: 'users', onDelete: 'CASCADE' }),
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('refresh_tokens');
    await queryRunner.dropTable('audit_logs');
    await queryRunner.dropTable('parameter_values');
    await queryRunner.dropTable('parameter_definitions');
  }
}
