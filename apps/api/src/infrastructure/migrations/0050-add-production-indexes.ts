import { MigrationInterface, QueryRunner, TableIndex } from 'typeorm';

export class AddProductionIndexes1721756400000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // CRM Indexes
    await queryRunner.query('ALTER TABLE leads ADD INDEX idx_org_client (organization_id, client_id)');
    await queryRunner.query('ALTER TABLE leads ADD INDEX idx_org_status (organization_id, status)');
    await queryRunner.query('ALTER TABLE leads ADD INDEX idx_org_created (organization_id, created_at DESC)');
    await queryRunner.query('ALTER TABLE opportunities ADD INDEX idx_org_lead (organization_id, lead_id)');
    await queryRunner.query('ALTER TABLE opportunities ADD INDEX idx_org_stage (organization_id, stage)');
    await queryRunner.query('ALTER TABLE contacts ADD INDEX idx_org_client (organization_id, client_id)');
    await queryRunner.query('ALTER TABLE interactions ADD INDEX idx_org_lead (organization_id, lead_id)');

    // Clients Indexes
    await queryRunner.query('ALTER TABLE clients ADD INDEX idx_org_created (organization_id, created_at DESC)');
    await queryRunner.query('ALTER TABLE clients ADD INDEX idx_org_status (organization_id, status)');

    // Production Indexes
    await queryRunner.query('ALTER TABLE pieces ADD INDEX idx_org_client (organization_id, client_id)');
    await queryRunner.query('ALTER TABLE pieces ADD INDEX idx_org_status (organization_id, status)');
    await queryRunner.query('ALTER TABLE pieces ADD INDEX idx_org_created (organization_id, created_at DESC)');

    // Content & Meetings
    await queryRunner.query('ALTER TABLE content_grids ADD INDEX idx_org_client (organization_id, client_id)');
    await queryRunner.query('ALTER TABLE meetings ADD INDEX idx_org_client (organization_id, client_id)');
    await queryRunner.query('ALTER TABLE meetings ADD INDEX idx_org_scheduled (organization_id, scheduled_at)');

    // Contracts & Briefs
    await queryRunner.query('ALTER TABLE contracts ADD INDEX idx_org_client (organization_id, client_id)');
    await queryRunner.query('ALTER TABLE contracts ADD INDEX idx_org_status (organization_id, status)');
    await queryRunner.query('ALTER TABLE briefs ADD INDEX idx_org_client (organization_id, client_id)');
    await queryRunner.query('ALTER TABLE briefs ADD INDEX idx_org_status (organization_id, status)');

    // Integration Indexes
    await queryRunner.query('ALTER TABLE integration_accounts ADD INDEX idx_org_type (organization_id, account_type)');
    await queryRunner.query('ALTER TABLE integration_metrics ADD INDEX idx_org_account_date (organization_id, external_account_id, metric_date)');
    await queryRunner.query('ALTER TABLE meta_lead_webhook_events ADD INDEX idx_page_leadgen (page_id, leadgen_id)');
    await queryRunner.query('ALTER TABLE meta_conversion_outbox ADD INDEX idx_org_status (organization_id, status, created_at)');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE leads DROP INDEX idx_org_client');
    await queryRunner.query('ALTER TABLE leads DROP INDEX idx_org_status');
    await queryRunner.query('ALTER TABLE leads DROP INDEX idx_org_created');
    await queryRunner.query('ALTER TABLE opportunities DROP INDEX idx_org_lead');
    await queryRunner.query('ALTER TABLE opportunities DROP INDEX idx_org_stage');
    await queryRunner.query('ALTER TABLE contacts DROP INDEX idx_org_client');
    await queryRunner.query('ALTER TABLE interactions DROP INDEX idx_org_lead');
    await queryRunner.query('ALTER TABLE clients DROP INDEX idx_org_created');
    await queryRunner.query('ALTER TABLE clients DROP INDEX idx_org_status');
    await queryRunner.query('ALTER TABLE pieces DROP INDEX idx_org_client');
    await queryRunner.query('ALTER TABLE pieces DROP INDEX idx_org_status');
    await queryRunner.query('ALTER TABLE pieces DROP INDEX idx_org_created');
    await queryRunner.query('ALTER TABLE content_grids DROP INDEX idx_org_client');
    await queryRunner.query('ALTER TABLE meetings DROP INDEX idx_org_client');
    await queryRunner.query('ALTER TABLE meetings DROP INDEX idx_org_scheduled');
    await queryRunner.query('ALTER TABLE contracts DROP INDEX idx_org_client');
    await queryRunner.query('ALTER TABLE contracts DROP INDEX idx_org_status');
    await queryRunner.query('ALTER TABLE briefs DROP INDEX idx_org_client');
    await queryRunner.query('ALTER TABLE briefs DROP INDEX idx_org_status');
    await queryRunner.query('ALTER TABLE integration_accounts DROP INDEX idx_org_type');
    await queryRunner.query('ALTER TABLE integration_metrics DROP INDEX idx_org_account_date');
    await queryRunner.query('ALTER TABLE meta_lead_webhook_events DROP INDEX idx_page_leadgen');
    await queryRunner.query('ALTER TABLE meta_conversion_outbox DROP INDEX idx_org_status');
  }
}
