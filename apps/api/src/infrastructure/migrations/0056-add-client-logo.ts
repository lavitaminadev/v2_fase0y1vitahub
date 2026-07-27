import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

/**
 * Logo de empresa alojado en Cloudinary.
 *
 * - `logo_url`: URL de entrega de la imagen.
 * - `logo_public_id`: identificador en Cloudinary, necesario para poder eliminarla.
 *
 * Las columnas se agregan solo si faltan, de modo que la migración pueda reejecutarse tras
 * una interrupción sin fallar por columna duplicada.
 */
export class AddClientLogo1724161000000 implements MigrationInterface {
  name = 'AddClientLogo1724161000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasColumn('clients', 'logo_url'))) {
      await queryRunner.addColumn('clients', new TableColumn({
        name: 'logo_url',
        type: 'varchar',
        length: '500',
        isNullable: true,
      }));
    }

    if (!(await queryRunner.hasColumn('clients', 'logo_public_id'))) {
      await queryRunner.addColumn('clients', new TableColumn({
        name: 'logo_public_id',
        type: 'varchar',
        length: '255',
        isNullable: true,
      }));
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasColumn('clients', 'logo_public_id')) {
      await queryRunner.dropColumn('clients', 'logo_public_id');
    }
    if (await queryRunner.hasColumn('clients', 'logo_url')) {
      await queryRunner.dropColumn('clients', 'logo_url');
    }
  }
}
