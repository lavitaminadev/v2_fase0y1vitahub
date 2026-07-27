import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Organization } from '../organizations/organization.entity';
import { Client } from '../clients/client.entity';
import { User } from '../users/user.entity';

@Entity('onboarding')
export class Onboarding {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'client_id', type: 'uuid' }) clientId: string;
  @ManyToOne(() => Client) @JoinColumn({ name: 'client_id' }) client: Client;
  @Column({ name: 'organization_id', type: 'uuid' }) organizationId: string;
  @ManyToOne(() => Organization) @JoinColumn({ name: 'organization_id' }) organization: Organization;
  @Column({ type: 'varchar', length: 255 }) step: string;
  @Column({ type: 'varchar', length: 20, default: 'pending' }) status: string;
  @Column({ name: 'assigned_to', type: 'uuid', nullable: true }) assignedTo?: string;
  @ManyToOne(() => User, { nullable: true }) @JoinColumn({ name: 'assigned_to' }) assignee?: User;
  @Column({ name: 'completed_at', type: 'timestamp', nullable: true }) completedAt?: Date;
  @Column({ type: 'text', nullable: true }) notes?: string;
  @Column({ name: 'blocked_reason', type: 'varchar', length: 1000, nullable: true }) blockedReason?: string;
  @Column({ name: 'required_documents', type: 'json', nullable: true }) requiredDocuments?: string[];
  @Column({ name: 'received_documents', type: 'json', nullable: true }) receivedDocuments?: string[];
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}
