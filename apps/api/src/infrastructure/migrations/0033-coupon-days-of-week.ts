import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddCouponDaysOfWeek1710000000033 implements MigrationInterface {
  name = 'AddCouponDaysOfWeek1710000000033';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!await queryRunner.hasColumn('reservation_coupons', 'valid_days_of_week')) {
      await queryRunner.addColumn('reservation_coupons', new TableColumn({ name: 'valid_days_of_week', type: 'json', isNullable: true }));
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasColumn('reservation_coupons', 'valid_days_of_week')) {
      await queryRunner.dropColumn('reservation_coupons', 'valid_days_of_week');
    }
  }
}
