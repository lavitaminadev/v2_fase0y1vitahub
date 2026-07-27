import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('reservations')
@Index('IDX_reservations_form_start', ['formId', 'startsAt'])
@Index('UQ_reservations_form_idempotency', ['formId', 'idempotencyKey'], { unique: true })
export class Reservation {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'organization_id', type: 'uuid' }) organizationId: string;
  @Column({ name: 'client_id', type: 'uuid' }) clientId: string;
  @Column({ name: 'form_id', type: 'uuid' }) formId: string;
  @Column({ name: 'reference_code', type: 'varchar', length: 20 }) referenceCode: string;
  @Column({ name: 'idempotency_key', type: 'varchar', length: 80, nullable: true }) idempotencyKey?: string;
  @Column({ type: 'varchar', length: 24, default: 'confirmed' }) status: string;
  @Column({ name: 'starts_at', type: 'timestamp' }) startsAt: Date;
  @Column({ name: 'ends_at', type: 'timestamp' }) endsAt: Date;
  @Column({ name: 'party_size', type: 'smallint', default: 1 }) partySize: number;
  @Column({ name: 'service_id', type: 'varchar', length: 120, nullable: true }) serviceId?: string;
  @Column({ name: 'resource_id', type: 'varchar', length: 120, nullable: true }) resourceId?: string;
  @Column({ name: 'guest_name', type: 'varchar', length: 180 }) guestName: string;
  @Column({ name: 'guest_email', type: 'varchar', length: 190, nullable: true }) guestEmail?: string;
  @Column({ name: 'guest_phone', type: 'varchar', length: 50, nullable: true }) guestPhone?: string;
  @Column({ name: 'answers', type: 'json' }) answers: Record<string, unknown>;
  @Column({ name: 'consent_version', type: 'varchar', length: 30, nullable: true }) consentVersion?: string;
  @Column({ name: 'internal_notes', type: 'text', nullable: true }) internalNotes?: string;
  @Column({ name: 'utm_source', type: 'varchar', length: 120, nullable: true }) utmSource?: string;
  @Column({ name: 'utm_medium', type: 'varchar', length: 120, nullable: true }) utmMedium?: string;
  @Column({ name: 'utm_campaign', type: 'varchar', length: 180, nullable: true }) utmCampaign?: string;
  @Column({ name: 'utm_content', type: 'varchar', length: 180, nullable: true }) utmContent?: string;
  @Column({ name: 'click_id', type: 'varchar', length: 255, nullable: true }) clickId?: string;
  @Column({ name: 'fbc', type: 'varchar', length: 255, nullable: true }) fbc?: string;
  @Column({ name: 'fbp', type: 'varchar', length: 255, nullable: true }) fbp?: string;
  @Column({ name: 'client_ip_address', type: 'varchar', length: 100, nullable: true }) clientIpAddress?: string;
  @Column({ name: 'client_user_agent', type: 'varchar', length: 500, nullable: true }) clientUserAgent?: string;
  @Column({ name: 'calendar_event_id', type: 'varchar', length: 255, nullable: true }) calendarEventId?: string;
  @Column({ name: 'calendar_url', type: 'varchar', length: 500, nullable: true }) calendarUrl?: string;
  @Column({ name: 'coupon_code', type: 'varchar', length: 80, nullable: true }) couponCode?: string;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}
