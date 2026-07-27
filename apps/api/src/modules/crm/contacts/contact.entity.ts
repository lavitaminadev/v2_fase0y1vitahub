import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Organization } from '../../organizations/organization.entity';
import { Lead } from '../leads/lead.entity';

@Entity('crm_contacts')
export class Contact {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'organization_id', type: 'uuid' }) organizationId: string;
  @ManyToOne(() => Organization) @JoinColumn({ name: 'organization_id' }) organization: Organization;
  @Column({ name: 'lead_id', type: 'uuid', nullable: true }) leadId?: string;
  @ManyToOne(() => Lead, { nullable: true }) @JoinColumn({ name: 'lead_id' }) lead?: Lead;
  @Column({ type: 'varchar', length: 255 }) name: string;
  @Column({ type: 'varchar', length: 255, nullable: true }) email?: string;
  @Column({ type: 'varchar', length: 50, nullable: true }) phone?: string;
  @Column({ type: 'varchar', length: 255, nullable: true }) position?: string;
  @Column({ type: 'text', nullable: true }) notes?: string;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}
