import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('pods')
@Index('UQ_pods_org_name', ['organizationId', 'name'], { unique: true })
export class Pod {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'organization_id', type: 'uuid' }) organizationId: string;
  @Column({ type: 'varchar', length: 150 }) name: string;
  @Column({ name: 'leader_id', type: 'uuid', nullable: true }) leaderId?: string;
  @Column({ type: 'varchar', length: 20, default: 'active' }) status: string;
  @Column({ name: 'monthly_capacity_ud', type: 'decimal', precision: 10, scale: 2, default: 80 }) monthlyCapacityUd: number;
  @Column({ type: 'text', nullable: true }) description?: string;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}
