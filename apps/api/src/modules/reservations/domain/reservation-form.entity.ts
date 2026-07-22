import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('reservation_forms')
@Index('UQ_reservation_forms_public_slug', ['publicSlug'], { unique: true })
export class ReservationForm {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'organization_id', type: 'uuid' }) organizationId: string;
  @Column({ name: 'client_id', type: 'uuid' }) clientId: string;
  @Column({ type: 'varchar', length: 180 }) name: string;
  @Column({ name: 'public_slug', type: 'varchar', length: 190 }) publicSlug: string;
  @Column({ type: 'varchar', length: 24, default: 'draft' }) status: string;
  @Column({ type: 'varchar', length: 30, default: 'appointment' }) mode: string;
  @Column({ type: 'varchar', length: 80, default: 'America/Santiago' }) timezone: string;
  @Column({ name: 'duration_minutes', type: 'smallint', default: 60 }) durationMinutes: number;
  @Column({ name: 'buffer_minutes', type: 'smallint', default: 0 }) bufferMinutes: number;
  @Column({ name: 'capacity_per_slot', type: 'smallint', default: 1 }) capacityPerSlot: number;
  @Column({ name: 'daily_capacity', type: 'smallint', default: 0 }) dailyCapacity: number;
  @Column({ name: 'minimum_notice_hours', type: 'smallint', default: 2 }) minimumNoticeHours: number;
  @Column({ name: 'maximum_advance_days', type: 'smallint', default: 60 }) maximumAdvanceDays: number;
  @Column({ name: 'confirmation_mode', type: 'varchar', length: 20, default: 'automatic' }) confirmationMode: string;
  @Column({ name: 'field_schema', type: 'json' }) fieldSchema: unknown[];
  @Column({ name: 'design_config', type: 'json' }) designConfig: Record<string, unknown>;
  @Column({ name: 'schedule_config', type: 'json' }) scheduleConfig: Record<string, unknown>;
  @Column({ name: 'services_config', type: 'json', nullable: true }) servicesConfig?: unknown[];
  @Column({ name: 'resources_config', type: 'json', nullable: true }) resourcesConfig?: unknown[];
  @Column({ name: 'campaign_id', type: 'varchar', length: 120, nullable: true }) campaignId?: string;
  @Column({ name: 'crm_enabled', type: 'boolean', default: false }) crmEnabled: boolean;
  @Column({ name: 'calendar_enabled', type: 'boolean', default: false }) calendarEnabled: boolean;
  @Column({ name: 'meta_capi_enabled', type: 'boolean', default: false }) metaCapiEnabled: boolean;
  @Column({ name: 'team_notifications', type: 'json', nullable: true }) teamNotifications?: string[];
  @Column({ name: 'created_by', type: 'uuid' }) createdBy: string;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}
