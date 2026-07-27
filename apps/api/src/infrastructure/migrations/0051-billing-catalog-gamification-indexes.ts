import { MigrationInterface, QueryRunner } from 'typeorm';
import { dropIndexes, ensureIndexes, IndexSpec } from './helpers/indexes';

const INDEXES: IndexSpec[] = [
  // invoices — listado y filtros por organizacion sin indice compuesto
  { table: 'invoices', name: 'IDX_invoices_org_status', columns: ['organization_id', 'status'] },
  { table: 'invoices', name: 'IDX_invoices_org_issued', columns: ['organization_id', 'issued_at'] },
  { table: 'invoices', name: 'IDX_invoices_org_client', columns: ['organization_id', 'client_id'] },

  // quotes — cotizaciones filtradas por organizacion/cliente/estado
  { table: 'quotes', name: 'IDX_quotes_org_status', columns: ['organization_id', 'status'] },
  { table: 'quotes', name: 'IDX_quotes_org_client', columns: ['organization_id', 'client_id'] },

  // charge_notes — notas de cobro filtradas por organizacion/estado
  { table: 'charge_notes', name: 'IDX_charge_notes_org_status', columns: ['organization_id', 'status'] },
  { table: 'charge_notes', name: 'IDX_charge_notes_org_client', columns: ['organization_id', 'client_id'] },

  // monthly_reports — reportes ejecutivos filtrados por organizacion/estado
  { table: 'monthly_reports', name: 'IDX_monthly_reports_org_status', columns: ['organization_id', 'status'] },

  // xp_periods — ranking semanal filtrado por organizacion/usuario
  { table: 'xp_periods', name: 'IDX_xp_periods_org_user', columns: ['organization_id', 'user_id'] },
  { table: 'xp_periods', name: 'IDX_xp_periods_org_week', columns: ['organization_id', 'week_start'] },

  // xp_events — join constante contra xp_periods y filtrado por usuario
  { table: 'xp_events', name: 'IDX_xp_events_period', columns: ['xp_period_id'] },
  { table: 'xp_events', name: 'IDX_xp_events_user', columns: ['user_id'] },
];

export class BillingCatalogGamificationIndexes1721756500000 implements MigrationInterface {
  name = 'BillingCatalogGamificationIndexes1721756500000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await ensureIndexes(queryRunner, INDEXES);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await dropIndexes(queryRunner, INDEXES);
  }
}
