import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddTeamNotifications1710000000030 implements MigrationInterface {
  name = 'AddTeamNotifications1710000000030';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!await queryRunner.hasColumn('reservation_forms', 'team_notifications')) {
      await queryRunner.addColumn('reservation_forms', new TableColumn({ name: 'team_notifications', type: 'json', isNullable: true }));
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasColumn('reservation_forms', 'team_notifications')) {
      await queryRunner.dropColumn('reservation_forms', 'team_notifications');
    }
  }
}
