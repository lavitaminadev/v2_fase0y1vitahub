import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { UDBudget } from './ud-budget.entity';
import { Piece } from '../production/piece.entity';

@Entity('ud_movements')
export class UDMovement {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'ud_budget_id', type: 'uuid' }) udBudgetId: string;
  @ManyToOne(() => UDBudget, { onDelete: 'CASCADE' }) @JoinColumn({ name: 'ud_budget_id' }) udBudget: UDBudget;
  @Column({ name: 'piece_id', type: 'uuid', nullable: true }) pieceId?: string;
  @ManyToOne(() => Piece, { nullable: true }) @JoinColumn({ name: 'piece_id' }) piece?: Piece;
  @Column({ type: 'varchar', length: 50 }) type: string;
  @Column({ type: 'decimal', precision: 8, scale: 2 }) amount: number;
  @Column({ type: 'varchar', length: 255, nullable: true }) reason?: string;
  @Column({ name: 'actor_id', type: 'uuid', nullable: true }) actorId?: string;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}
