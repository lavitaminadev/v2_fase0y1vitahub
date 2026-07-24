import { MigrationInterface, QueryRunner } from 'typeorm';

export class BillingCatalogGamificationIndexes1721756500000 implements MigrationInterface {
  name = 'BillingCatalogGamificationIndexes1721756500000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // invoices — listado y filtros por organizacion sin indice compuesto
    await queryRunner.query('ALTER TABLE invoices ADD INDEX IDX_invoices_org_status (organization_id, status)');
    await queryRunner.query('ALTER TABLE invoices ADD INDEX IDX_invoices_org_issued (organization_id, issued_at)');
    await queryRunner.query('ALTER TABLE invoices ADD INDEX IDX_invoices_org_client (organization_id, client_id)');

    // quotes — cotizaciones filtradas por organizacion/cliente/estado
    await queryRunner.query('ALTER TABLE quotes ADD INDEX IDX_quotes_org_status (organization_id, status)');
    await queryRunner.query('ALTER TABLE quotes ADD INDEX IDX_quotes_org_client (organization_id, client_id)');

    // charge_notes — notas de cobro filtradas por organizacion/estado
    await queryRunner.query('ALTER TABLE charge_notes ADD INDEX IDX_charge_notes_org_status (organization_id, status)');
    await queryRunner.query('ALTER TABLE charge_notes ADD INDEX IDX_charge_notes_org_client (organization_id, client_id)');

    // monthly_reports — reportes ejecutivos filtrados por organizacion/estado
    await queryRunner.query('ALTER TABLE monthly_reports ADD INDEX IDX_monthly_reports_org_status (organization_id, status)');

    // xp_periods — ranking semanal filtrado por organizacion/usuario
    await queryRunner.query('ALTER TABLE xp_periods ADD INDEX IDX_xp_periods_org_user (organization_id, user_id)');
    await queryRunner.query('ALTER TABLE xp_periods ADD INDEX IDX_xp_periods_org_week (organization_id, week_start)');

    // xp_events — join constante contra xp_periods y filtrado por usuario
    await queryRunner.query('ALTER TABLE xp_events ADD INDEX IDX_xp_events_period (xp_period_id)');
    await queryRunner.query('ALTER TABLE xp_events ADD INDEX IDX_xp_events_user (user_id)');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE invoices DROP INDEX IDX_invoices_org_status');
    await queryRunner.query('ALTER TABLE invoices DROP INDEX IDX_invoices_org_issued');
    await queryRunner.query('ALTER TABLE invoices DROP INDEX IDX_invoices_org_client');
    await queryRunner.query('ALTER TABLE quotes DROP INDEX IDX_quotes_org_status');
    await queryRunner.query('ALTER TABLE quotes DROP INDEX IDX_quotes_org_client');
    await queryRunner.query('ALTER TABLE charge_notes DROP INDEX IDX_charge_notes_org_status');
    await queryRunner.query('ALTER TABLE charge_notes DROP INDEX IDX_charge_notes_org_client');
    await queryRunner.query('ALTER TABLE monthly_reports DROP INDEX IDX_monthly_reports_org_status');
    await queryRunner.query('ALTER TABLE xp_periods DROP INDEX IDX_xp_periods_org_user');
    await queryRunner.query('ALTER TABLE xp_periods DROP INDEX IDX_xp_periods_org_week');
    await queryRunner.query('ALTER TABLE xp_events DROP INDEX IDX_xp_events_period');
    await queryRunner.query('ALTER TABLE xp_events DROP INDEX IDX_xp_events_user');
  }
}
