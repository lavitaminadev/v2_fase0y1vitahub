import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

/**
 * Franja horaria de validez de un cupón.
 *
 * Los cupones ya acotaban dia de la semana y rango de fechas, pero no hora, que es lo que
 * distingue una promocion de almuerzo de una de cena. Se guarda como `HH:MM` en la zona
 * horaria del formulario, igual que las ventanas de atencion.
 *
 * Nulo en ambas columnas significa "cualquier hora", que es como quedan los cupones
 * existentes: la migracion no cambia el comportamiento de lo ya creado.
 */
export class CouponTimeWindow1724163000000 implements MigrationInterface {
  name = 'CouponTimeWindow1724163000000';

  private readonly columns = ['valid_from_time', 'valid_until_time'];

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const name of this.columns) {
      if (!(await queryRunner.hasColumn('reservation_coupons', name))) {
        await queryRunner.addColumn('reservation_coupons', new TableColumn({
          name,
          type: 'varchar',
          length: '5',
          isNullable: true,
        }));
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const name of this.columns) {
      if (await queryRunner.hasColumn('reservation_coupons', name)) {
        await queryRunner.dropColumn('reservation_coupons', name);
      }
    }
  }
}
