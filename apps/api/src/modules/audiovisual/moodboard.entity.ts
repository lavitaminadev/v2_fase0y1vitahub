import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Organization } from '../organizations/organization.entity';
import { Client } from '../clients/client.entity';

@Entity('moodboards')
export class Moodboard {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'organization_id', type: 'uuid' }) organizationId: string;
  @ManyToOne(() => Organization) @JoinColumn({ name: 'organization_id' }) organization: Organization;
  @Column({ name: 'client_id', type: 'uuid' }) clientId: string;
  @ManyToOne(() => Client) @JoinColumn({ name: 'client_id' }) client: Client;
  @Column({ type: 'varchar', length: 255 }) title: string;
  @Column({ type: 'text', nullable: true }) description?: string;
  @Column({ type: 'json', nullable: true }) images?: string[];
  @Column({ name: 'created_by', type: 'uuid', nullable: true }) createdBy?: string;
  @Column({ name: 'verified_by', type: 'uuid', nullable: true }) verifiedBy?: string;
  @Column({ type: 'varchar', length: 20, default: 'draft' }) status: string;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}
