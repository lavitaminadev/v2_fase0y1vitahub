import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Organization } from '../../organizations/organization.entity';
import { Lead } from '../leads/lead.entity';
import { Client } from '../../clients/client.entity';

@Entity('crm_opportunities')
export class Opportunity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'organization_id', type: 'uuid' }) organizationId: string;
  @ManyToOne(() => Organization) @JoinColumn({ name: 'organization_id' }) organization: Organization;
  @Column({ name: 'lead_id', type: 'uuid', nullable: true }) leadId?: string;
  @Column({ name: 'client_id', type: 'uuid', nullable: true }) clientId?: string;
  @Column({ type: 'varchar', length: 255 }) name: string;
  @Column({ type: 'decimal', precision: 18, scale: 2, nullable: true }) amount?: number;
  @Column({ type: 'varchar', length: 50, default: 'new' }) stage: string;
  @Column({ type: 'int', default: 0 }) probability: number;
  @Column({ name: 'expected_close_date', type: 'date', nullable: true }) expectedCloseDate?: Date;
  @Column({ name: 'next_action', type: 'varchar', length: 500, nullable: true }) nextAction?: string;
  @Column({ name: 'next_action_at', type: 'timestamp', nullable: true }) nextActionAt?: Date;
  @Column({ name: 'assigned_to', type: 'uuid', nullable: true }) assignedTo?: string;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}
