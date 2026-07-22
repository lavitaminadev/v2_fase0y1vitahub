import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('reservation_form_events')
@Index('IDX_reservation_form_events_form_date', ['formId', 'createdAt'])
@Index('UQ_reservation_form_event_session', ['formId', 'type', 'sessionId'], { unique: true })
export class ReservationFormEvent {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'organization_id', type: 'uuid' }) organizationId: string;
  @Column({ name: 'client_id', type: 'uuid' }) clientId: string;
  @Column({ name: 'form_id', type: 'uuid' }) formId: string;
  @Column({ type: 'varchar', length: 20 }) type: string;
  @Column({ name: 'session_id', type: 'varchar', length: 80, nullable: true }) sessionId?: string;
  @Column({ name: 'utm_source', type: 'varchar', length: 120, nullable: true }) utmSource?: string;
  @Column({ name: 'utm_campaign', type: 'varchar', length: 180, nullable: true }) utmCampaign?: string;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
}
