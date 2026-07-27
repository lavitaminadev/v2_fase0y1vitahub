import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { User } from '../users/user.entity';

@Entity('xp_periods')
export class XPPeriod {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'organization_id', type: 'uuid' }) organizationId: string;
  @Column({ name: 'user_id', type: 'uuid' }) userId: string;
  @ManyToOne(() => User, { onDelete: 'CASCADE' }) @JoinColumn({ name: 'user_id' }) user: User;
  @Column({ name: 'week_start', type: 'date' }) weekStart: Date;
  @Column({ name: 'week_end', type: 'date' }) weekEnd: Date;
  @Column({ name: 'total_xp', type: 'int', default: 0 }) totalXp: number;
  @Column({ type: 'varchar', length: 20, nullable: true }) tier?: string;
  @Column({ type: 'varchar', length: 20, default: 'open' }) status: string;
  @Column({ name: 'closed_at', type: 'timestamp', nullable: true }) closedAt?: Date;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}
