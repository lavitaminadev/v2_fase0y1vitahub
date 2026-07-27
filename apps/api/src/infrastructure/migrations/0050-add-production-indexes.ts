import { MigrationInterface, QueryRunner } from 'typeorm';
import { dropIndexes, ensureIndexes, IndexSpec } from './helpers/indexes';

/** Indices de consulta por organizacion. */
const INDEXES: IndexSpec[] = [
  // CRM
  { table: 'leads', name: 'idx_org_client', columns: ['organization_id', 'client_id'] },
  { table: 'leads', name: 'idx_org_status', columns: ['organization_id', 'status'] },
  { table: 'leads', name: 'idx_org_created', columns: ['organization_id', 'created_at'], definition: '(organization_id, created_at DESC)' },
  { table: 'crm_opportunities', name: 'idx_org_lead', columns: ['organization_id', 'lead_id'] },
  { table: 'crm_opportunities', name: 'idx_org_stage', columns: ['organization_id', 'stage'] },
  // crm_contacts se relaciona con el lead, no con el cliente: no tiene columna client_id.
  { table: 'crm_contacts', name: 'idx_org_lead', columns: ['organization_id', 'lead_id'] },
  { table: 'crm_interactions', name: 'idx_org_lead', columns: ['organization_id', 'lead_id'] },

  // Clientes
  { table: 'clients', name: 'idx_org_created', columns: ['organization_id', 'created_at'], definition: '(organization_id, created_at DESC)' },
  { table: 'clients', name: 'idx_org_status', columns: ['organization_id', 'status'] },

  // Produccion
  { table: 'pieces', name: 'idx_org_client', columns: ['organization_id', 'client_id'] },
  { table: 'pieces', name: 'idx_org_status', columns: ['organization_id', 'status'] },
  { table: 'pieces', name: 'idx_org_created', columns: ['organization_id', 'created_at'], definition: '(organization_id, created_at DESC)' },

  // Contenido y reuniones
  { table: 'content_grids', name: 'idx_org_client', columns: ['organization_id', 'client_id'] },
  { table: 'meetings', name: 'idx_org_client', columns: ['organization_id', 'client_id'] },
  { table: 'meetings', name: 'idx_org_scheduled', columns: ['organization_id', 'scheduled_at'] },

  // Contratos y briefs
  { table: 'contracts', name: 'idx_org_client', columns: ['organization_id', 'client_id'] },
  { table: 'contracts', name: 'idx_org_status', columns: ['organization_id', 'status'] },
  { table: 'briefs', name: 'idx_org_client', columns: ['organization_id', 'client_id'] },
  { table: 'briefs', name: 'idx_org_status', columns: ['organization_id', 'status'] },

  // Integraciones
  { table: 'integration_accounts', name: 'idx_org_type', columns: ['organization_id', 'account_type'] },
  { table: 'integration_metrics', name: 'idx_org_account_date', columns: ['organization_id', 'external_account_id', 'metric_date'] },
  { table: 'meta_lead_webhook_events', name: 'idx_page_leadgen', columns: ['page_id', 'leadgen_id'] },
  { table: 'meta_conversion_outbox', name: 'idx_org_status', columns: ['organization_id', 'status', 'created_at'] },
];

export class AddProductionIndexes1721756400000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await ensureIndexes(queryRunner, INDEXES);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await dropIndexes(queryRunner, INDEXES);
  }
}
