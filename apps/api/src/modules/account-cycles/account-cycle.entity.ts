import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { Client } from '../clients/client.entity';

@Entity('account_cycles')
@Index('UQ_account_cycles_client_period', ['clientId', 'year', 'month'], { unique: true })
export class AccountCycle {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'organization_id', type: 'uuid' }) organizationId: string;
  @Column({ name: 'client_id', type: 'uuid' }) clientId: string;
  @ManyToOne(() => Client, { onDelete: 'CASCADE' }) @JoinColumn({ name: 'client_id' }) client: Client;
  @Column({ type: 'smallint' }) year: number;
  @Column({ type: 'tinyint' }) month: number;
  @Column({ type: 'varchar', length: 30, default: 'planning' }) status: string;
  @Column({ name: 'grid_status', type: 'varchar', length: 30, default: 'pending' }) gridStatus: string;
  @Column({ name: 'production_status', type: 'varchar', length: 30, default: 'pending' }) productionStatus: string;
  @Column({ name: 'weekly_meetings_due', type: 'tinyint', default: 4 }) weeklyMeetingsDue: number;
  @Column({ name: 'weekly_meetings_completed', type: 'tinyint', default: 0 }) weeklyMeetingsCompleted: number;
  @Column({ name: 'strategy_meeting_status', type: 'varchar', length: 30, default: 'pending' }) strategyMeetingStatus: string;
  @Column({ name: 'report_status', type: 'varchar', length: 30, default: 'pending' }) reportStatus: string;
  @Column({ name: 'started_at', type: 'date' }) startedAt: Date;
  @Column({ name: 'ends_at', type: 'date' }) endsAt: Date;
  @Column({ name: 'closed_at', type: 'timestamp', nullable: true }) closedAt?: Date;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}
