import { MigrationInterface, QueryRunner, Table, TableColumn, TableForeignKey, TableIndex } from 'typeorm';

export class AdminAccessSecurity1710000000020 implements MigrationInterface {
  name = 'AdminAccessSecurity1710000000020';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await this.ensureColumn(queryRunner, 'users', new TableColumn({ name: 'work_mode', type: 'varchar', length: '20', isNullable: true }));
    await this.ensureColumn(queryRunner, 'users', new TableColumn({ name: 'must_change_password', type: 'boolean', default: false }));
    await this.ensureColumn(queryRunner, 'users', new TableColumn({ name: 'invited_at', type: 'timestamp', isNullable: true }));
    await this.ensureColumn(queryRunner, 'users', new TableColumn({ name: 'password_changed_at', type: 'timestamp', isNullable: true }));

    if (!await queryRunner.hasTable('password_reset_tokens')) {
      await queryRunner.createTable(new Table({
        name: 'password_reset_tokens',
        columns: [
          { name: 'id', type: 'uuid', isPrimary: true, generationStrategy: 'uuid', isGenerated: true },
          { name: 'organization_id', type: 'uuid' },
          { name: 'user_id', type: 'uuid' },
          { name: 'token_hash', type: 'varchar', length: '64', isUnique: true },
          { name: 'expires_at', type: 'timestamp' },
          { name: 'used_at', type: 'timestamp', isNullable: true },
          { name: 'created_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
        ],
        foreignKeys: [
          new TableForeignKey({ columnNames: ['organization_id'], referencedTableName: 'organizations', referencedColumnNames: ['id'], onDelete: 'CASCADE' }),
          new TableForeignKey({ columnNames: ['user_id'], referencedTableName: 'users', referencedColumnNames: ['id'], onDelete: 'CASCADE' }),
        ],
        indices: [
          new TableIndex({ name: 'IDX_password_reset_user', columnNames: ['user_id', 'used_at'] }),
          new TableIndex({ name: 'IDX_password_reset_expiry', columnNames: ['expires_at'] }),
        ],
      }));
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('password_reset_tokens')) await queryRunner.dropTable('password_reset_tokens');
    for (const column of ['password_changed_at', 'invited_at', 'must_change_password', 'work_mode']) {
      if (await queryRunner.hasColumn('users', column)) await queryRunner.dropColumn('users', column);
    }
  }

  private async ensureColumn(queryRunner: QueryRunner, table: string, column: TableColumn): Promise<void> {
    if (!await queryRunner.hasColumn(table, column.name)) await queryRunner.addColumn(table, column);
  }
}
