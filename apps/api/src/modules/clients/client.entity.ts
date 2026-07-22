import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, BeforeInsert, BeforeUpdate } from 'typeorm';
import { Organization } from '../organizations/organization.entity';
import { Lead } from '../crm/leads/lead.entity';
import { ClientStatus } from './client-status.enum';
import { ClientCapabilities, normalizeClientCapabilities } from './client-capabilities';

@Entity('clients')
export class Client {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'organization_id', type: 'uuid' }) organizationId: string;
  @ManyToOne(() => Organization) @JoinColumn({ name: 'organization_id' }) organization: Organization;
  @Column({ name: 'lead_id', type: 'uuid', nullable: true }) leadId?: string;
  @ManyToOne(() => Lead, { nullable: true }) @JoinColumn({ name: 'lead_id' }) lead?: Lead;
  @Column({ name: 'community_manager_id', type: 'uuid', nullable: true }) communityManagerId?: string;
  @Column({ name: 'pod_id', type: 'uuid', nullable: true }) podId?: string;
  @Column({ type: 'varchar', length: 255 }) name: string;
  @Column({ name: 'legal_name', type: 'varchar', length: 255, nullable: true }) legalName?: string;
  @Column({ type: 'varchar', length: 255, nullable: true }) industry?: string;
  @Column({ type: 'varchar', length: 50, default: ClientStatus.ONBOARDING }) status: ClientStatus;
  @Column({ name: 'retainer_amount', type: 'decimal', precision: 18, scale: 2, nullable: true }) retainerAmount?: number;
  @Column({ type: 'char', length: 3, default: 'CLP' }) currency: string;
  @Column({ name: 'started_at', type: 'date', nullable: true }) startedAt?: Date;
  @Column({ name: 'renewal_at', type: 'date', nullable: true }) renewalAt?: Date;
  @Column({ name: 'whatsapp_group', type: 'varchar', length: 255, nullable: true }) whatsappGroup?: string;
  @Column({ name: 'drive_folder_id', type: 'varchar', length: 255, nullable: true }) driveFolderId?: string;
  @Column({ name: 'default_ud_budget', type: 'decimal', precision: 8, scale: 2, default: 20 }) defaultUdBudget: number;
  @Column({ type: 'json', nullable: true }) capabilities?: ClientCapabilities;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;

  @BeforeInsert()
  @BeforeUpdate()
  normalize(): void {
    this.name = this.name?.trim().replace(/\s+/g, ' ');
    this.legalName = this.legalName?.trim().replace(/\s+/g, ' ') || undefined;
    this.industry = this.industry?.trim().replace(/\s+/g, ' ') || undefined;
    this.currency = this.currency?.trim().toUpperCase() || 'CLP';
    this.capabilities = normalizeClientCapabilities(this.capabilities);
  }
}
