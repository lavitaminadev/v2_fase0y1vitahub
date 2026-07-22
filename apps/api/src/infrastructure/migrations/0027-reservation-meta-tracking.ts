import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class ReservationMetaTracking1710000000027 implements MigrationInterface {
  name = 'ReservationMetaTracking1710000000027';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const column of [
      { name: 'fbc', type: 'varchar', length: '255', isNullable: true },
      { name: 'fbp', type: 'varchar', length: '255', isNullable: true },
      { name: 'client_ip_address', type: 'varchar', length: '100', isNullable: true },
      { name: 'client_user_agent', type: 'varchar', length: '500', isNullable: true },
    ]) {
      if (!await queryRunner.hasColumn('reservations', column.name)) {
        await queryRunner.addColumn('reservations', new TableColumn(column));
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const columnName of ['client_user_agent', 'client_ip_address', 'fbp', 'fbc']) {
      if (await queryRunner.hasColumn('reservations', columnName)) {
        await queryRunner.dropColumn('reservations', columnName);
      }
    }
  }
}
