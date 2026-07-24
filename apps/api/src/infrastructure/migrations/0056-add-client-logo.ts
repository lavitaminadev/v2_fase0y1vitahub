import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

/**
 * Agregar campos para guardar logo de empresa:
 * - logo_url: URL completa de la imagen en Cloudinary
 * - logo_public_id: ID público en Cloudinary para poder eliminarlo después
 */
export class AddClientLogo1724161000000 implements MigrationInterface {
  name = 'AddClientLogo1724161000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn('clients', new TableColumn({
      name: 'logo_url',
      type: 'varchar',
      length: '500',
      isNullable: true,
    }));

    await queryRunner.addColumn('clients', new TableColumn({
      name: 'logo_public_id',
      type: 'varchar',
      length: '255',
      isNullable: true,
    }));
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('clients', 'logo_public_id');
    await queryRunner.dropColumn('clients', 'logo_url');
  }
}
