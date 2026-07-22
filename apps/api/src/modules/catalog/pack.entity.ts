import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Organization } from '../organizations/organization.entity';

@Entity('catalog_packs')
export class Pack {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'organization_id', type: 'uuid' }) organizationId: string;
  @ManyToOne(() => Organization) @JoinColumn({ name: 'organization_id' }) organization: Organization;
  @Column({ type: 'varchar', length: 255 }) name: string;
  @Column({ type: 'text', nullable: true }) description?: string;
  @Column({ name: 'monthly_ud', type: 'decimal', precision: 8, scale: 2, default: 0 }) monthlyUd: number;
  @Column({ name: 'reels_included', type: 'int', default: 0 }) reelsIncluded: number;
  @Column({ name: 'monthly_price', type: 'decimal', precision: 18, scale: 2, nullable: true }) monthlyPrice?: number;
  @Column({ type: 'char', length: 3, default: 'CLP' }) currency: string;
  @Column({ type: 'text', nullable: true }) services?: string;
  @Column({ type: 'varchar', length: 20, default: 'active' }) status: string;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
}
