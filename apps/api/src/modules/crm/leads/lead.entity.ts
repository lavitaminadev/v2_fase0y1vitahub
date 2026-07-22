import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, BeforeInsert, BeforeUpdate, Index } from 'typeorm';
import { Organization } from '../../organizations/organization.entity';

@Entity('leads')
@Index('UQ_leads_org_external', ['organizationId', 'externalLeadId'], { unique: true })
export class Lead {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'organization_id', type: 'uuid' }) organizationId: string;
  @ManyToOne(() => Organization) @JoinColumn({ name: 'organization_id' }) organization: Organization;
  @Column({ type: 'varchar', length: 255 }) name: string;
  @Column({ type: 'varchar', length: 255, nullable: true }) email?: string | null;
  @Column({ type: 'varchar', length: 20, nullable: true }) phone?: string | null;
  @Column({ type: 'varchar', length: 255, nullable: true }) company?: string | null;
  @Column({ type: 'varchar', length: 255, nullable: true }) source?: string;
  @Column({ name: 'source_detail', type: 'varchar', length: 255, nullable: true }) sourceDetail?: string | null;
  @Column({ name: 'client_id', type: 'uuid', nullable: true }) clientId?: string;
  @Column({ type: 'json', nullable: true }) tags?: string[];
  @Column({ name: 'external_lead_id', type: 'varchar', length: 255, nullable: true }) externalLeadId?: string;
  @Column({ name: 'external_form_id', type: 'varchar', length: 255, nullable: true }) externalFormId?: string;
  @Column({ name: 'external_campaign_id', type: 'varchar', length: 255, nullable: true }) externalCampaignId?: string;
  @Column({ name: 'campaign_name', type: 'varchar', length: 255, nullable: true }) campaignName?: string | null;
  @Column({ name: 'page_id', type: 'varchar', length: 255, nullable: true }) pageId?: string;
  @Column({ type: 'varchar', length: 50, default: 'new' }) status: string;
  @Column({ name: 'fit_status', type: 'varchar', length: 50, default: 'review' }) fitStatus: string;
  @Column({ name: 'quality_score', type: 'int', default: 0 }) qualityScore: number;
  @Column({ name: 'discard_reason', type: 'text', nullable: true }) discardReason?: string;
  @Column({ name: 'assigned_to', type: 'uuid', nullable: true }) assignedTo?: string;
  @Column({ type: 'text', nullable: true }) notes?: string;
  @Column({ name: 'consent_captured_at', type: 'timestamp', nullable: true }) consentCapturedAt?: Date;
  @Column({ name: 'retention_review_at', type: 'timestamp', nullable: true }) retentionReviewAt?: Date;
  @Column({ type: 'json', nullable: true }) metadata?: Record<string, any>;
  @Column({ name: 'converted_at', type: 'timestamp', nullable: true }) convertedAt?: Date;
  @Column({ name: 'converted_to_client_id', type: 'uuid', nullable: true }) convertedToClientId?: string;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;

  @BeforeInsert()
  @BeforeUpdate()
  normalize(): void {
    this.name = this.name?.trim();
    this.email = this.email?.trim().toLowerCase() || null;
    this.phone = this.phone?.replace(/[^\d+]/g, '') || null;
    this.company = this.company?.trim() || null;
    this.source = this.source?.trim() || undefined;
    this.sourceDetail = this.sourceDetail?.trim() || null;
    this.campaignName = this.campaignName?.trim() || null;
    this.notes = this.notes?.trim() || undefined;
  }
}
