import { MigrationInterface, QueryRunner } from 'typeorm';
import { dropIndexes, ensureIndexes, IndexSpec } from './helpers/indexes';

/**
 * Índices de consulta frecuente en auditoría, reservas y cola de conversiones.
 *
 * Varias de estas columnas ya están indexadas por las migraciones que crean sus tablas
 * (`0002`, `0004`, `0011`, `0014`, `0017`), por lo que `ensureIndexes` omite lo existente y
 * solo agrega lo que falta.
 */
const INDEXES: IndexSpec[] = [
  { table: 'audit_logs', name: 'IDX_audit_org', columns: ['organization_id'] },
  { table: 'audit_logs', name: 'IDX_audit_actor', columns: ['actor_id'] },
  { table: 'audit_logs', name: 'IDX_audit_entity', columns: ['entity_type', 'entity_id'] },
  { table: 'audit_logs', name: 'IDX_audit_occurred', columns: ['occurred_at'] },

  { table: 'reservations', name: 'IDX_reserv_status', columns: ['status'] },
  { table: 'reservations', name: 'IDX_reserv_starts', columns: ['starts_at'] },
  { table: 'reservations', name: 'IDX_reserv_form_starts', columns: ['form_id', 'starts_at'] },

  { table: 'reservation_events', name: 'IDX_reserv_events_rid', columns: ['reservation_id'] },
  { table: 'reservation_form_events', name: 'IDX_form_events_created', columns: ['created_at'] },

  { table: 'meta_conversion_outbox', name: 'IDX_outbox_status_next', columns: ['status', 'next_attempt_at'] },

  { table: 'clients', name: 'IDX_clients_org', columns: ['organization_id'] },
  { table: 'users', name: 'IDX_users_org', columns: ['organization_id'] },
];

export class CriticalIndexes1710000000034 implements MigrationInterface {
  name = 'CriticalIndexes1710000000034';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await ensureIndexes(queryRunner, INDEXES);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await dropIndexes(queryRunner, INDEXES);
  }
}
