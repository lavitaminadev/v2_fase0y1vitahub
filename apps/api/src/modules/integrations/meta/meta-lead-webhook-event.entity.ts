import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('meta_lead_webhook_events')
@Index('UQ_meta_lead_webhook_page_lead', ['pageId', 'leadgenId'], { unique: true })
export class MetaLeadWebhookEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'organization_id', type: 'uuid', nullable: true })
  organizationId?: string;

  @Column({ name: 'page_id', type: 'varchar', length: 255 })
  pageId: string;

  @Column({ name: 'leadgen_id', type: 'varchar', length: 255 })
  leadgenId: string;

  @Column({ name: 'form_id', type: 'varchar', length: 255, nullable: true })
  formId?: string;

  @Column({ name: 'processing_status', type: 'varchar', length: 50, default: 'received' })
  processingStatus: string;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage?: string;

  @Column({ name: 'raw_payload', type: 'json' })
  rawPayload: Record<string, any>;

  @Column({ name: 'normalized_payload', type: 'json', nullable: true })
  normalizedPayload?: Record<string, any>;

  @Column({ name: 'processed_at', type: 'timestamp', nullable: true })
  processedAt?: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
