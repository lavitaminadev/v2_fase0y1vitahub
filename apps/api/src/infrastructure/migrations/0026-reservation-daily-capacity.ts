import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class ReservationDailyCapacity1710000000026 implements MigrationInterface {
  name = 'ReservationDailyCapacity1710000000026';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!await queryRunner.hasColumn('reservation_forms', 'daily_capacity')) {
      await queryRunner.addColumn('reservation_forms', new TableColumn({
        name: 'daily_capacity',
        type: 'smallint',
        default: 0,
        isNullable: false,
      }));
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasColumn('reservation_forms', 'daily_capacity')) {
      await queryRunner.dropColumn('reservation_forms', 'daily_capacity');
    }
  }
}
