import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

/**
 * Agregar Google Analytics 4 al formulario de reservas:
 * - ga4_measurement_id: ID de medición GA4 (formato G-XXXXXXXXXX)
 *
 * A diferencia del pixel de Meta (que se resuelve por cliente vía
 * MetaClientPixelService), GA4 se configura por formulario porque cada
 * landing puede reportar a una propiedad distinta.
 */
export class AddGa4MeasurementId1724247400000 implements MigrationInterface {
  name = 'AddGa4MeasurementId1724247400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasColumn('reservation_forms', 'ga4_measurement_id')) return;
    await queryRunner.addColumn('reservation_forms', new TableColumn({
      name: 'ga4_measurement_id',
      type: 'varchar',
      length: '40',
      isNullable: true,
    }));
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasColumn('reservation_forms', 'ga4_measurement_id'))) return;
    await queryRunner.dropColumn('reservation_forms', 'ga4_measurement_id');
  }
}
