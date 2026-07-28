import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

/**
 * Alinea `organizations` con su entidad.
 *
 * - `welcome_message`: mensaje de bienvenida del espacio, declarado en la entidad pero
 *   ausente en el esquema, lo que hacia fallar cualquier SELECT sobre organizations.
 * - `logo_url`: la entidad declara 500 caracteres y el esquema tenia 255; las URL de
 *   Cloudinary con transformaciones superan los 255.
 *
 * Los cambios se aplican solo si hacen falta, para poder reejecutar la migracion tras una
 * interrupcion sin fallar por columna duplicada.
 */
export class OrganizationWelcomeMessage1724162000000 implements MigrationInterface {
  name = 'OrganizationWelcomeMessage1724162000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasColumn('organizations', 'welcome_message'))) {
      await queryRunner.addColumn('organizations', new TableColumn({
        name: 'welcome_message',
        type: 'varchar',
        length: '500',
        isNullable: true,
      }));
    }

    // Se amplia con MODIFY en vez de `changeColumn`: TypeORM resuelve el cambio de longitud
    // con DROP + ADD, que borraria los logos ya cargados. MODIFY conserva los valores.
    const table = await queryRunner.getTable('organizations');
    const logoUrl = table?.findColumnByName('logo_url');
    if (logoUrl && logoUrl.length !== '500') {
      await queryRunner.query('ALTER TABLE `organizations` MODIFY COLUMN `logo_url` varchar(500) NULL');
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasColumn('organizations', 'welcome_message')) {
      await queryRunner.dropColumn('organizations', 'welcome_message');
    }
  }
}
