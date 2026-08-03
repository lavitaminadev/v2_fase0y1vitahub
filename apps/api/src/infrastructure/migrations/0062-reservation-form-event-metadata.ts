import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class ReservationFormEventMetadata1724248700000 implements MigrationInterface {
  name = 'ReservationFormEventMetadata1724248700000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasColumn('reservation_form_events', 'metadata')) return;
    await queryRunner.addColumn('reservation_form_events', new TableColumn({
      name: 'metadata',
      type: 'json',
      isNullable: true,
    }));
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasColumn('reservation_form_events', 'metadata'))) return;
    await queryRunner.dropColumn('reservation_form_events', 'metadata');
  }
}
