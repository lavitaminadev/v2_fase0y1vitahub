import { MigrationInterface, QueryRunner, Table, TableColumn, TableIndex } from 'typeorm';

export class MetaIdempotency1710000000012 implements MigrationInterface {
  name = 'MetaIdempotency1710000000012';

  async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('meta_lead_webhook_events'))) {
      await queryRunner.createTable(new Table({
        name: 'meta_lead_webhook_events',
        columns: [
          { name: 'id', type: 'uuid', isPrimary: true, generationStrategy: 'uuid' },
          { name: 'organization_id', type: 'uuid', isNullable: true },
          { name: 'page_id', type: 'varchar', length: '255' },
          { name: 'leadgen_id', type: 'varchar', length: '255' },
          { name: 'form_id', type: 'varchar', length: '255', isNullable: true },
          { name: 'processing_status', type: 'varchar', length: '50', default: "'received'" },
          { name: 'error_message', type: 'text', isNullable: true },
          { name: 'raw_payload', type: 'json' },
          { name: 'normalized_payload', type: 'json', isNullable: true },
          { name: 'processed_at', type: 'timestamp', isNullable: true },
          { name: 'created_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
          { name: 'updated_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
        ],
      }), true);
    }

    const leadColumns = [
      new TableColumn({ name: 'source_detail', type: 'varchar', length: '255', isNullable: true }),
      new TableColumn({ name: 'external_lead_id', type: 'varchar', length: '255', isNullable: true }),
      new TableColumn({ name: 'external_form_id', type: 'varchar', length: '255', isNullable: true }),
      new TableColumn({ name: 'external_campaign_id', type: 'varchar', length: '255', isNullable: true }),
      new TableColumn({ name: 'campaign_name', type: 'varchar', length: '255', isNullable: true }),
      new TableColumn({ name: 'page_id', type: 'varchar', length: '255', isNullable: true }),
      new TableColumn({ name: 'fit_status', type: 'varchar', length: '50', default: "'review'" }),
      new TableColumn({ name: 'quality_score', type: 'int', default: 0 }),
      new TableColumn({ name: 'discard_reason', type: 'text', isNullable: true }),
      new TableColumn({ name: 'consent_captured_at', type: 'timestamp', isNullable: true }),
      new TableColumn({ name: 'retention_review_at', type: 'timestamp', isNullable: true }),
      new TableColumn({ name: 'metadata', type: 'json', isNullable: true }),
    ];
    const leadsTable = await queryRunner.getTable('leads');
    for (const column of leadColumns) {
      if (!leadsTable?.findColumnByName(column.name)) await queryRunner.addColumn('leads', column);
    }

    const metaTable = await queryRunner.getTable('meta_lead_webhook_events');
    if (!metaTable?.indices.some((index) => index.name === 'UQ_meta_lead_webhook_page_lead')) {
      await queryRunner.createIndex('meta_lead_webhook_events', new TableIndex({
        name: 'UQ_meta_lead_webhook_page_lead',
        columnNames: ['page_id', 'leadgen_id'],
        isUnique: true,
      }));
    }

    const refreshedLeadsTable = await queryRunner.getTable('leads');
    if (!refreshedLeadsTable?.indices.some((index) => index.name === 'UQ_leads_org_external')) {
      await queryRunner.createIndex('leads', new TableIndex({
        name: 'UQ_leads_org_external',
        columnNames: ['organization_id', 'external_lead_id'],
        isUnique: true,
      }));
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    const leadsTable = await queryRunner.getTable('leads');
    if (leadsTable?.indices.some((index) => index.name === 'UQ_leads_org_external')) {
      await queryRunner.dropIndex('leads', 'UQ_leads_org_external');
    }
    const metaTable = await queryRunner.getTable('meta_lead_webhook_events');
    if (metaTable?.indices.some((index) => index.name === 'UQ_meta_lead_webhook_page_lead')) {
      await queryRunner.dropIndex('meta_lead_webhook_events', 'UQ_meta_lead_webhook_page_lead');
    }
  }
}
