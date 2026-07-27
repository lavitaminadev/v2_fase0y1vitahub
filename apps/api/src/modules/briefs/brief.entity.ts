import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Organization } from '../organizations/organization.entity';
import { Client } from '../clients/client.entity';

@Entity('briefs')
export class Brief {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'organization_id', type: 'uuid' }) organizationId: string;
  @ManyToOne(() => Organization) @JoinColumn({ name: 'organization_id' }) organization: Organization;
  @Column({ name: 'client_id', type: 'uuid', nullable: true }) clientId?: string;
  @ManyToOne(() => Client, { nullable: true }) @JoinColumn({ name: 'client_id' }) client?: Client;
  @Column({ type: 'varchar', length: 255 }) title: string;
  @Column({ type: 'text', nullable: true }) description?: string;
  @Column({ type: 'json', nullable: true }) requirements?: Record<string, any>;
  @Column({ type: 'varchar', length: 20, default: 'draft' }) status: string;
  @Column({ name: 'due_date', type: 'date', nullable: true }) dueDate?: Date;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}
