import { MigrationInterface, QueryRunner } from 'typeorm';
import { dropIndexes, ensureIndexes, IndexSpec } from './helpers/indexes';

/**
 * Índices compuestos para los listados paginados que filtran por `organization_id` y ordenan
 * por su columna de fecha por defecto (`findAndCount` / `find` con `order: { createdAt/date }`).
 *
 * Estas tablas ya tenían índices sobre `organization_id` combinado con `status`/`client_id`
 * (migraciones 0050/0051), pero ninguno cubre la columna de orden. Sin el índice, MySQL resuelve
 * el filtro por organización y luego hace filesort para el ORDER BY — el mismo patrón corregido
 * en 0067 para `reservations`/`crm_contacts`, presente aquí en oportunidades, briefs, contratos,
 * moodboards/sesiones audiovisuales, cotizaciones y notas de cobro.
 */
const INDEXES: IndexSpec[] = [
  { table: 'crm_opportunities', name: 'IDX_crm_opportunities_org_created', columns: ['organization_id', 'created_at'] },
  { table: 'briefs', name: 'IDX_briefs_org_created', columns: ['organization_id', 'created_at'] },
  { table: 'contracts', name: 'IDX_contracts_org_created', columns: ['organization_id', 'created_at'] },
  { table: 'moodboards', name: 'IDX_moodboards_org_created', columns: ['organization_id', 'created_at'] },
  { table: 'av_sessions', name: 'IDX_av_sessions_org_date', columns: ['organization_id', 'date'] },
  { table: 'quotes', name: 'IDX_quotes_org_created', columns: ['organization_id', 'created_at'] },
  { table: 'charge_notes', name: 'IDX_charge_notes_org_created', columns: ['organization_id', 'created_at'] },
  { table: 'approval_requests', name: 'IDX_approval_requests_org_created', columns: ['organization_id', 'created_at'] },
];

export class ListingOrderByIndexes1725400000000 implements MigrationInterface {
  name = 'ListingOrderByIndexes1725400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await ensureIndexes(queryRunner, INDEXES);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await dropIndexes(queryRunner, INDEXES);
  }
}
