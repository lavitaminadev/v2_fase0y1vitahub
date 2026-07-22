import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Piece } from './piece.entity';
import { PieceVersion } from './piece-version.entity';
import { CorrectionOrigin } from './correction-origin.enum';

@Entity('corrections')
export class Correction {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'piece_id', type: 'uuid' }) pieceId: string;
  @ManyToOne(() => Piece, { onDelete: 'CASCADE' }) @JoinColumn({ name: 'piece_id' }) piece: Piece;
  @Column({ name: 'piece_version_id', type: 'uuid', nullable: true }) pieceVersionId?: string;
  @ManyToOne(() => PieceVersion, { nullable: true }) @JoinColumn({ name: 'piece_version_id' }) pieceVersion?: PieceVersion;
  @Column({ type: 'varchar', length: 50 }) origin: CorrectionOrigin;
  @Column({ type: 'text' }) description: string;
  @Column({ name: 'requested_by', type: 'uuid', nullable: true }) requestedBy?: string;
  @Column({ name: 'billable_extra', type: 'boolean', default: false }) billableExtra: boolean;
  @Column({ name: 'charge_note_required', type: 'boolean', default: false }) chargeNoteRequired: boolean;
  @Column({ name: 'resolved_by', type: 'uuid', nullable: true }) resolvedBy?: string;
  @Column({ name: 'resolved_at', type: 'timestamp', nullable: true }) resolvedAt?: Date;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}
