import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('meta_conversion_outbox')
@Index('UQ_meta_conversion_event', ['organizationId', 'eventId'], { unique: true })
export class MetaConversionOutbox {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'organization_id', type: 'uuid' }) organizationId: string;
  @Column({ name: 'event_id', type: 'varchar', length: 255 }) eventId: string;
  @Column({ name: 'pixel_id', type: 'varchar', length: 255 }) pixelId: string;
  @Column({ name: 'event_data', type: 'json' }) eventData: Record<string, any>;
  @Column({ type: 'varchar', length: 20, default: 'pending' }) status: string;
  @Column({ type: 'int', default: 0 }) attempts: number;
  @Column({ name: 'next_attempt_at', type: 'timestamp', nullable: true }) nextAttemptAt?: Date;
  @Column({ name: 'last_error', type: 'text', nullable: true }) lastError?: string;
  @Column({ name: 'processed_at', type: 'timestamp', nullable: true }) processedAt?: Date;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}
