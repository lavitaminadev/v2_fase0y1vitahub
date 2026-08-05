import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from 'typeorm';

/**
 * Cargos que hasta ahora veían todas las cuentas sin asignación alguna.
 *
 * Al pasar el alcance a pods y asignaciones, quedarían sin nada que ver. La migración les
 * escribe el acceso que ya ejercían, para que el cambio sea de control y no de operación:
 * quien administra recorta desde la pantalla de personas cuando quiera, con el efecto a la
 * vista. Cambiarles el alcance en silencio dentro de una migración dejaría al equipo sin
 * cuentas un lunes por la mañana y sin forma de saber por qué.
 *
 * `admin` no aparece porque no necesita filas: ve todo por cargo. `client` y
 * `community_manager` tampoco, porque ya estaban acotados y su alcance no cambia.
 */
const PREVIOUSLY_UNRESTRICTED_ROLES = [
  'commercial_director',
  'operations_director',
  'creative_director',
  'art_director',
  'av_director',
  'ai_lead',
  'designer',
  'audiovisual',
];

export class UserClientAccess1725800000000 implements MigrationInterface {
  name = 'UserClientAccess1725800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('user_client_access'))) {
      await queryRunner.createTable(new Table({
        name: 'user_client_access',
        columns: [
          { name: 'id', type: 'uuid', isPrimary: true, generationStrategy: 'uuid', isGenerated: true },
          { name: 'organization_id', type: 'uuid' },
          { name: 'user_id', type: 'uuid' },
          { name: 'client_id', type: 'uuid' },
          { name: 'reason', type: 'varchar', length: '255', isNullable: true },
          { name: 'granted_by', type: 'uuid', isNullable: true },
          { name: 'created_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
        ],
        foreignKeys: [
          new TableForeignKey({ columnNames: ['organization_id'], referencedTableName: 'organizations', referencedColumnNames: ['id'], onDelete: 'CASCADE' }),
          new TableForeignKey({ columnNames: ['user_id'], referencedTableName: 'users', referencedColumnNames: ['id'], onDelete: 'CASCADE' }),
          new TableForeignKey({ columnNames: ['client_id'], referencedTableName: 'clients', referencedColumnNames: ['id'], onDelete: 'CASCADE' }),
          new TableForeignKey({ columnNames: ['granted_by'], referencedTableName: 'users', referencedColumnNames: ['id'], onDelete: 'SET NULL' }),
        ],
        indices: [
          new TableIndex({ name: 'UQ_user_client_access_pair', columnNames: ['user_id', 'client_id'], isUnique: true }),
          new TableIndex({ name: 'IDX_user_client_access_user', columnNames: ['organization_id', 'user_id'] }),
        ],
      }));
    }

    const roles = PREVIOUSLY_UNRESTRICTED_ROLES.map(() => '?').join(',');
    await queryRunner.query(
      `INSERT INTO \`user_client_access\` (\`id\`, \`organization_id\`, \`user_id\`, \`client_id\`, \`reason\`)
       SELECT UUID(), c.\`organization_id\`, u.\`id\`, c.\`id\`,
              'Acceso que el cargo ya ejercia antes del alcance por cuenta'
         FROM \`users\` u
         JOIN \`clients\` c ON c.\`organization_id\` = u.\`organization_id\`
        WHERE u.\`is_active\` = 1
          AND u.\`role\` IN (${roles})
          AND NOT EXISTS (
                SELECT 1 FROM \`user_client_access\` a
                 WHERE a.\`user_id\` = u.\`id\` AND a.\`client_id\` = c.\`id\`
              )`,
      PREVIOUSLY_UNRESTRICTED_ROLES,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('user_client_access')) await queryRunner.dropTable('user_client_access');
  }
}
