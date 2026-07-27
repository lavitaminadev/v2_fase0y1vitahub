import { MigrationInterface, QueryRunner, Table, TableForeignKey } from 'typeorm';

const formForeignKey = (table: string): TableForeignKey => new TableForeignKey({
  name: `FK_${table}_form`,
  columnNames: ['form_id'],
  referencedTableName: 'reservation_forms',
  referencedColumnNames: ['id'],
  onDelete: 'CASCADE',
});

export class Reservations1710000000017 implements MigrationInterface {
  name = 'Reservations1710000000017';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(new Table({
      name: 'reservation_forms',
      columns: [
        { name: 'id', type: 'uuid', isPrimary: true, generationStrategy: 'uuid' },
        { name: 'organization_id', type: 'uuid' },
        { name: 'client_id', type: 'uuid' },
        { name: 'name', type: 'varchar', length: '180' },
        { name: 'public_slug', type: 'varchar', length: '190', isUnique: true },
        { name: 'status', type: 'varchar', length: '24', default: "'draft'" },
        { name: 'mode', type: 'varchar', length: '30', default: "'appointment'" },
        { name: 'timezone', type: 'varchar', length: '80', default: "'America/Santiago'" },
        { name: 'duration_minutes', type: 'smallint', default: 60 },
        { name: 'buffer_minutes', type: 'smallint', default: 0 },
        { name: 'capacity_per_slot', type: 'smallint', default: 1 },
        { name: 'minimum_notice_hours', type: 'smallint', default: 2 },
        { name: 'maximum_advance_days', type: 'smallint', default: 60 },
        { name: 'confirmation_mode', type: 'varchar', length: '20', default: "'automatic'" },
        { name: 'field_schema', type: 'json' },
        { name: 'design_config', type: 'json' },
        { name: 'schedule_config', type: 'json' },
        { name: 'services_config', type: 'json', isNullable: true },
        { name: 'resources_config', type: 'json', isNullable: true },
        { name: 'campaign_id', type: 'varchar', length: '120', isNullable: true },
        { name: 'created_by', type: 'uuid' },
        { name: 'created_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
        { name: 'updated_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' },
      ],
      indices: [
        { name: 'UQ_reservation_forms_public_slug', columnNames: ['public_slug'], isUnique: true },
        { name: 'IDX_reservation_forms_org_client', columnNames: ['organization_id', 'client_id'] },
      ],
    }), true);

    await queryRunner.createTable(new Table({
      name: 'reservation_availability_blocks',
      columns: [
        { name: 'id', type: 'uuid', isPrimary: true, generationStrategy: 'uuid' },
        { name: 'organization_id', type: 'uuid' },
        { name: 'client_id', type: 'uuid' },
        { name: 'form_id', type: 'uuid' },
        { name: 'starts_at', type: 'timestamp' },
        { name: 'ends_at', type: 'timestamp' },
        { name: 'reason', type: 'varchar', length: '180', isNullable: true },
        { name: 'created_by', type: 'uuid' },
        { name: 'created_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
      ],
      indices: [{ name: 'IDX_reservation_blocks_form_range', columnNames: ['form_id', 'starts_at', 'ends_at'] }],
      foreignKeys: [formForeignKey('reservation_blocks')],
    }), true);

    await queryRunner.createTable(new Table({
      name: 'reservations',
      columns: [
        { name: 'id', type: 'uuid', isPrimary: true, generationStrategy: 'uuid' },
        { name: 'organization_id', type: 'uuid' },
        { name: 'client_id', type: 'uuid' },
        { name: 'form_id', type: 'uuid' },
        { name: 'reference_code', type: 'varchar', length: '20', isUnique: true },
        { name: 'status', type: 'varchar', length: '24', default: "'confirmed'" },
        { name: 'starts_at', type: 'timestamp' },
        { name: 'ends_at', type: 'timestamp' },
        { name: 'party_size', type: 'smallint', default: 1 },
        { name: 'service_id', type: 'varchar', length: '120', isNullable: true },
        { name: 'resource_id', type: 'varchar', length: '120', isNullable: true },
        { name: 'guest_name', type: 'varchar', length: '180' },
        { name: 'guest_email', type: 'varchar', length: '190', isNullable: true },
        { name: 'guest_phone', type: 'varchar', length: '50', isNullable: true },
        { name: 'answers', type: 'json' },
        { name: 'consent_version', type: 'varchar', length: '30', isNullable: true },
        { name: 'internal_notes', type: 'text', isNullable: true },
        { name: 'utm_source', type: 'varchar', length: '120', isNullable: true },
        { name: 'utm_medium', type: 'varchar', length: '120', isNullable: true },
        { name: 'utm_campaign', type: 'varchar', length: '180', isNullable: true },
        { name: 'utm_content', type: 'varchar', length: '180', isNullable: true },
        { name: 'click_id', type: 'varchar', length: '255', isNullable: true },
        { name: 'created_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
        { name: 'updated_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' },
      ],
      indices: [
        { name: 'UQ_reservations_reference', columnNames: ['reference_code'], isUnique: true },
        { name: 'IDX_reservations_form_start', columnNames: ['form_id', 'starts_at'] },
        { name: 'IDX_reservations_org_client', columnNames: ['organization_id', 'client_id'] },
      ],
      foreignKeys: [formForeignKey('reservations')],
    }), true);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('reservations');
    await queryRunner.dropTable('reservation_availability_blocks');
    await queryRunner.dropTable('reservation_forms');
  }
}
