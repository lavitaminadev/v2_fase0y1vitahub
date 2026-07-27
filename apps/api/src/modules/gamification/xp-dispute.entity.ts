import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { XPPeriod } from './xp-period.entity';
import { User } from '../users/user.entity';

@Entity('xp_disputes')
@Index('IDX_xp_disputes_org_status', ['organizationId', 'status'])
export class XPDispute {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'organization_id', type: 'uuid' }) organizationId: string;
  @Column({ name: 'xp_period_id', type: 'uuid' }) xpPeriodId: string;
  @ManyToOne(() => XPPeriod, { onDelete: 'CASCADE' }) @JoinColumn({ name: 'xp_period_id' }) period: XPPeriod;
  @Column({ name: 'user_id', type: 'uuid' }) userId: string;
  @ManyToOne(() => User, { onDelete: 'CASCADE' }) @JoinColumn({ name: 'user_id' }) user: User;
  @Column({ type: 'text' }) message: string;
  @Column({ type: 'varchar', length: 20, default: 'pending' }) status: string;
  @Column({ type: 'text', nullable: true }) resolution?: string;
  @Column({ name: 'adjustment_points', type: 'int', default: 0 }) adjustmentPoints: number;
  @Column({ name: 'resolved_by', type: 'uuid', nullable: true }) resolvedBy?: string;
  @Column({ name: 'resolved_at', type: 'timestamp', nullable: true }) resolvedAt?: Date;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}
