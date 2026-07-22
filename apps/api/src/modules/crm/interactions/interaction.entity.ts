import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Organization } from '../../organizations/organization.entity';
import { Lead } from '../leads/lead.entity';
import { Contact } from '../contacts/contact.entity';

@Entity('crm_interactions')
export class Interaction {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'organization_id', type: 'uuid' }) organizationId: string;
  @ManyToOne(() => Organization) @JoinColumn({ name: 'organization_id' }) organization: Organization;
  @Column({ name: 'lead_id', type: 'uuid', nullable: true }) leadId?: string;
  @Column({ name: 'contact_id', type: 'uuid', nullable: true }) contactId?: string;
  @Column({ type: 'varchar', length: 50 }) type: string;
  @Column({ type: 'text', nullable: true }) description?: string;
  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' }) date: Date;
  @Column({ name: 'created_by', type: 'uuid', nullable: true }) createdBy?: string;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
}
