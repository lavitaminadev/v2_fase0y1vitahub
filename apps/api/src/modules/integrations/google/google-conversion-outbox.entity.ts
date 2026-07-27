import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

/**
 * Cola persistente de conversiones pendientes de subir a Google Ads.
 *
 * Espeja `meta_conversion_outbox`: en iHosting no hay worker persistente ni
 * Redis, así que el reintento se apoya en el cron de cPanel que ya dispara
 * `core/cron` por HTTP.
 */
@Entity('google_conversion_outbox')
@Index('UQ_google_conversion_event', ['organizationId', 'eventId'], { unique: true })
export class GoogleConversionOutbox {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'organization_id', type: 'uuid' }) organizationId: string;
  /** Identificador estable del evento, para no duplicar al reintentar. */
  @Column({ name: 'event_id', type: 'varchar', length: 255 }) eventId: string;
  /** Customer ID de Google Ads (sin guiones). */
  @Column({ name: 'customer_id', type: 'varchar', length: 32 }) customerId: string;
  /** Nombre de recurso: customers/{id}/conversionActions/{id} */
  @Column({ name: 'conversion_action', type: 'varchar', length: 255 }) conversionAction: string;
  @Column({ name: 'conversion_data', type: 'json' }) conversionData: Record<string, any>;
  @Column({ type: 'varchar', length: 20, default: 'pending' }) status: string;
  @Column({ type: 'int', default: 0 }) attempts: number;
  @Column({ name: 'next_attempt_at', type: 'timestamp', nullable: true }) nextAttemptAt?: Date;
  @Column({ name: 'last_error', type: 'text', nullable: true }) lastError?: string;
  @Column({ name: 'processed_at', type: 'timestamp', nullable: true }) processedAt?: Date;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}
