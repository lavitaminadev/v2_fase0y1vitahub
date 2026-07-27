import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

/**
 * Excepciones de permiso por usuario y módulo.
 *
 * Guarda solo las desviaciones respecto del cargo: la ausencia de filas equivale a la
 * configuración estándar definida en `role-permissions.ts`.
 */
export class UserPermissionOverrides1724247700000 implements MigrationInterface {
  name = 'UserPermissionOverrides1724247700000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('user_permission_overrides')) return;
    await queryRunner.createTable(new Table({
      name: 'user_permission_overrides',
      columns: [
        { name: 'id', type: 'varchar', length: '36', isPrimary: true, isGenerated: true, generationStrategy: 'uuid' },
        { name: 'organization_id', type: 'varchar', length: '36' },
        { name: 'user_id', type: 'varchar', length: '36' },
        { name: 'module', type: 'varchar', length: '60' },
        { name: 'level', type: 'varchar', length: '20' },
        { name: 'reason', type: 'varchar', length: '300', isNullable: true },
        { name: 'granted_by', type: 'varchar', length: '36', isNullable: true },
        { name: 'created_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
        { name: 'updated_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' },
      ],
    }), true);

    // Una sola excepción por usuario y módulo: dos filas para el mismo par harían que el
    // nivel efectivo dependiera del orden de lectura.
    await queryRunner.createIndex('user_permission_overrides', new TableIndex({
      name: 'UQ_user_permission_override',
      columnNames: ['user_id', 'module'],
      isUnique: true,
    }));
    await queryRunner.createIndex('user_permission_overrides', new TableIndex({
      name: 'IDX_user_permission_override_org',
      columnNames: ['organization_id', 'user_id'],
    }));
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('user_permission_overrides'))) return;
    await queryRunner.dropTable('user_permission_overrides');
  }
}
