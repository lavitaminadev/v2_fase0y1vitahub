import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { User } from '../users/user.entity';
import { Piece } from '../production/piece.entity';

@Entity('xp_events')
export class XPEvent {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'xp_period_id', type: 'uuid' }) xpPeriodId: string;
  @Column({ name: 'user_id', type: 'uuid', nullable: true }) userId?: string;
  @Column({ name: 'piece_id', type: 'uuid', nullable: true }) pieceId?: string;
  @ManyToOne(() => Piece, { nullable: true }) @JoinColumn({ name: 'piece_id' }) piece?: Piece;
  @Column({ name: 'event_type', type: 'varchar', length: 50 }) eventType: string;
  @Column({ type: 'int' }) points: number;
  @Column({ type: 'varchar', length: 255, nullable: true }) description?: string;
  @Column({ type: 'json', nullable: true }) metadata?: Record<string, any>;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}
