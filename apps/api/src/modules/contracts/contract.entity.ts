import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Organization } from '../organizations/organization.entity';
import { Client } from '../clients/client.entity';

@Entity('contracts')
export class Contract {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'organization_id', type: 'uuid' }) organizationId: string;
  @ManyToOne(() => Organization) @JoinColumn({ name: 'organization_id' }) organization: Organization;
  @Column({ name: 'client_id', type: 'uuid', nullable: true }) clientId?: string;
  @ManyToOne(() => Client, { nullable: true }) @JoinColumn({ name: 'client_id' }) client?: Client;
  @Column({ type: 'varchar', length: 255 }) name: string;
  @Column({ name: 'service_type', type: 'varchar', length: 255, nullable: true }) serviceType?: string;
  @Column({ name: 'start_date', type: 'date' }) startDate: Date;
  @Column({ name: 'end_date', type: 'date', nullable: true }) endDate?: Date;
  @Column({ name: 'monthly_ud', type: 'decimal', precision: 8, scale: 2, default: 0 }) monthlyUd: number;
  @Column({ name: 'pack_id', type: 'uuid', nullable: true }) packId?: string;
  @Column({ name: 'monthly_price', type: 'decimal', precision: 18, scale: 2, default: 0 }) monthlyPrice: number;
  @Column({ name: 'committed_ad_spend', type: 'decimal', precision: 18, scale: 2, default: 0 }) committedAdSpend: number;
  @Column({ name: 'included_reels', type: 'int', default: 0 }) includedReels: number;
  @Column({ name: 'billing_cycle', type: 'varchar', length: 30, default: 'monthly_advance' }) billingCycle: string;
  @Column({ type: 'varchar', length: 20, default: 'active' }) status: string;
  @Column({ type: 'text', nullable: true }) terms?: string;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}
