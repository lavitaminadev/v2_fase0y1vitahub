import { MigrationInterface, QueryRunner } from 'typeorm';

export class CriticalIndexes1710000000034 implements MigrationInterface {
  name = 'CriticalIndexes1710000000034';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // audit_logs — zero indexes, full table scans on every query
    await queryRunner.query(`ALTER TABLE audit_logs ADD INDEX IDX_audit_org (organization_id)`);
    await queryRunner.query(`ALTER TABLE audit_logs ADD INDEX IDX_audit_actor (actor_id)`);
    await queryRunner.query(`ALTER TABLE audit_logs ADD INDEX IDX_audit_entity (entity_type, entity_id)`);
    await queryRunner.query(`ALTER TABLE audit_logs ADD INDEX IDX_audit_occurred (occurred_at)`);

    // reservations — frequent queries by status, date range, form
    await queryRunner.query(`ALTER TABLE reservations ADD INDEX IDX_reserv_status (status)`);
    await queryRunner.query(`ALTER TABLE reservations ADD INDEX IDX_reserv_starts (starts_at)`);
    await queryRunner.query(`ALTER TABLE reservations ADD INDEX IDX_reserv_form_starts (form_id, starts_at)`);

    // reservation_events — joined on reservation_id
    await queryRunner.query(`ALTER TABLE reservation_events ADD INDEX IDX_reserv_events_rid (reservation_id)`);

    // reservation_form_events — filtered by created_at in metrics
    await queryRunner.query(`ALTER TABLE reservation_form_events ADD INDEX IDX_form_events_created (created_at)`);

    // meta_conversion_outbox — filtered by status + next_attempt_at
    await queryRunner.query(`ALTER TABLE meta_conversion_outbox ADD INDEX IDX_outbox_status_next (status, next_attempt_at)`);

    // clients — organization_id is a FK without index in many queries
    await queryRunner.query(`ALTER TABLE clients ADD INDEX IDX_clients_org (organization_id)`);

    // users — organization_id used in login/lookup queries
    await queryRunner.query(`ALTER TABLE users ADD INDEX IDX_users_org (organization_id)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE audit_logs DROP INDEX IDX_audit_org`);
    await queryRunner.query(`ALTER TABLE audit_logs DROP INDEX IDX_audit_actor`);
    await queryRunner.query(`ALTER TABLE audit_logs DROP INDEX IDX_audit_entity`);
    await queryRunner.query(`ALTER TABLE audit_logs DROP INDEX IDX_audit_occurred`);
    await queryRunner.query(`ALTER TABLE reservations DROP INDEX IDX_reserv_status`);
    await queryRunner.query(`ALTER TABLE reservations DROP INDEX IDX_reserv_starts`);
    await queryRunner.query(`ALTER TABLE reservations DROP INDEX IDX_reserv_form_starts`);
    await queryRunner.query(`ALTER TABLE reservation_events DROP INDEX IDX_reserv_events_rid`);
    await queryRunner.query(`ALTER TABLE reservation_form_events DROP INDEX IDX_form_events_created`);
    await queryRunner.query(`ALTER TABLE meta_conversion_outbox DROP INDEX IDX_outbox_status_next`);
    await queryRunner.query(`ALTER TABLE clients DROP INDEX IDX_clients_org`);
    await queryRunner.query(`ALTER TABLE users DROP INDEX IDX_users_org`);
  }
}
