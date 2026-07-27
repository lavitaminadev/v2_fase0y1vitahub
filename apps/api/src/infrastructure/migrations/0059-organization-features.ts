import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

/**
 * Modulos habilitados por organizacion.
 *
 * Se deja nullable y sin valor por defecto en la base: la normalizacion vive en la entidad
 * (`normalizeOrganizationFeatures`), asi que agregar una clave nueva al catalogo no obliga
 * a una migracion de datos — las filas existentes la resuelven al valor por defecto.
 */
export class OrganizationFeatures1724247600000 implements MigrationInterface {
  name = 'OrganizationFeatures1724247600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasColumn('organizations', 'features')) return;
    await queryRunner.addColumn('organizations', new TableColumn({
      name: 'features',
      type: 'json',
      isNullable: true,
    }));
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasColumn('organizations', 'features'))) return;
    await queryRunner.dropColumn('organizations', 'features');
  }
}
