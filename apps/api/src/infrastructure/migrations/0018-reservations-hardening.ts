import { MigrationInterface, QueryRunner, Table, TableForeignKey } from 'typeorm';

const reservationForeignKey = (table: string, column: string, referencedTable: string, onDelete: 'CASCADE'): TableForeignKey => new TableForeignKey({
  name: `FK_${table}_${column.replace(/_id$/, '')}`,
  columnNames: [column],
  referencedTableName: referencedTable,
  referencedColumnNames: ['id'],
  onDelete,
});

export class ReservationsHardening1710000000018 implements MigrationInterface {
  name = 'ReservationsHardening1710000000018';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE reservation_forms ADD crm_enabled tinyint NOT NULL DEFAULT 0, ADD calendar_enabled tinyint NOT NULL DEFAULT 0, ADD meta_capi_enabled tinyint NOT NULL DEFAULT 0`);
    await queryRunner.query(`ALTER TABLE reservations ADD idempotency_key varchar(80) NULL, ADD calendar_event_id varchar(255) NULL, ADD calendar_url varchar(500) NULL, ADD UNIQUE KEY UQ_reservations_form_idempotency (form_id, idempotency_key)`);

    await queryRunner.createTable(new Table({
      name: 'reservation_events',
      columns: [
        { name: 'id', type: 'uuid', isPrimary: true, generationStrategy: 'uuid' },
        { name: 'organization_id', type: 'uuid' },
        { name: 'client_id', type: 'uuid' },
        { name: 'reservation_id', type: 'uuid' },
        { name: 'type', type: 'varchar', length: '40' },
        { name: 'from_status', type: 'varchar', length: '24', isNullable: true },
        { name: 'to_status', type: 'varchar', length: '24', isNullable: true },
        { name: 'actor_id', type: 'uuid', isNullable: true },
        { name: 'actor_type', type: 'varchar', length: '20', default: "'system'" },
        { name: 'metadata', type: 'json', isNullable: true },
        { name: 'created_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
      ],
      indices: [{ name: 'IDX_reservation_events_reservation', columnNames: ['reservation_id', 'created_at'] }],
      foreignKeys: [reservationForeignKey('reservation_events', 'reservation_id', 'reservations', 'CASCADE')],
    }), true);

    await queryRunner.createTable(new Table({
      name: 'reservation_form_events',
      columns: [
        { name: 'id', type: 'uuid', isPrimary: true, generationStrategy: 'uuid' },
        { name: 'organization_id', type: 'uuid' },
        { name: 'client_id', type: 'uuid' },
        { name: 'form_id', type: 'uuid' },
        { name: 'type', type: 'varchar', length: '20' },
        { name: 'session_id', type: 'varchar', length: '80', isNullable: true },
        { name: 'utm_source', type: 'varchar', length: '120', isNullable: true },
        { name: 'utm_campaign', type: 'varchar', length: '180', isNullable: true },
        { name: 'created_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
      ],
      indices: [
        { name: 'UQ_reservation_form_event_session', columnNames: ['form_id', 'type', 'session_id'], isUnique: true },
        { name: 'IDX_reservation_form_events_form_date', columnNames: ['form_id', 'created_at'] },
        { name: 'IDX_reservation_form_events_org_client', columnNames: ['organization_id', 'client_id'] },
      ],
      foreignKeys: [reservationForeignKey('reservation_form_events', 'form_id', 'reservation_forms', 'CASCADE')],
    }), true);

    await queryRunner.createForeignKey('reservation_forms', reservationForeignKey('reservation_forms', 'client_id', 'clients', 'CASCADE'));
    await queryRunner.createForeignKey('reservations', reservationForeignKey('reservations', 'client_id', 'clients', 'CASCADE'));
    await queryRunner.createForeignKey('reservation_availability_blocks', reservationForeignKey('reservation_blocks', 'client_id', 'clients', 'CASCADE'));
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropForeignKey('reservation_availability_blocks', 'FK_reservation_blocks_client');
    await queryRunner.dropForeignKey('reservations', 'FK_reservations_client');
    await queryRunner.dropForeignKey('reservation_forms', 'FK_reservation_forms_client');
    await queryRunner.dropTable('reservation_form_events');
    await queryRunner.dropTable('reservation_events');
    await queryRunner.query('ALTER TABLE reservations DROP INDEX UQ_reservations_form_idempotency, DROP COLUMN calendar_url, DROP COLUMN calendar_event_id, DROP COLUMN idempotency_key');
    await queryRunner.query('ALTER TABLE reservation_forms DROP COLUMN meta_capi_enabled, DROP COLUMN calendar_enabled, DROP COLUMN crm_enabled');
  }
}
