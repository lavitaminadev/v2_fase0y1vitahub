import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Organization } from '../organizations/organization.entity';
import { Client } from '../clients/client.entity';

@Entity('av_sessions')
export class Session {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'organization_id', type: 'uuid' }) organizationId: string;
  @ManyToOne(() => Organization) @JoinColumn({ name: 'organization_id' }) organization: Organization;
  @Column({ name: 'client_id', type: 'uuid' }) clientId: string;
  @ManyToOne(() => Client) @JoinColumn({ name: 'client_id' }) client: Client;
  @Column({ type: 'varchar', length: 50 }) type: string;
  @Column({ type: 'date' }) date: Date;
  @Column({ type: 'varchar', length: 255, nullable: true }) location?: string;
  @Column({ name: 'assigned_team', type: 'json', nullable: true }) assignedTeam?: string[];
  @Column({ name: 'moodboard_id', type: 'uuid', nullable: true }) moodboardId?: string;
  @Column({ type: 'varchar', length: 20, default: 'scheduled' }) status: string;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}
