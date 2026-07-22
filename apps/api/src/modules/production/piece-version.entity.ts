import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Piece } from './piece.entity';

@Entity('piece_versions')
export class PieceVersion {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'piece_id', type: 'uuid' }) pieceId: string;
  @ManyToOne(() => Piece, { onDelete: 'CASCADE' }) @JoinColumn({ name: 'piece_id' }) piece: Piece;
  @Column({ name: 'version_number', type: 'int' }) versionNumber: number;
  @Column({ name: 'file_name', type: 'varchar', length: 255 }) fileName: string;
  @Column({ name: 'drive_file_id', type: 'varchar', length: 255, nullable: true }) driveFileId?: string;
  @Column({ name: 'state_label', type: 'varchar', length: 50, nullable: true }) stateLabel?: string;
  @Column({ name: 'is_final', type: 'boolean', default: false }) isFinal: boolean;
  @Column({ name: 'naming_valid', type: 'boolean', nullable: true }) namingValid?: boolean;
  @Column({ name: 'naming_errors', type: 'json', nullable: true }) namingErrors?: string[];
  @Column({ name: 'created_by', type: 'uuid', nullable: true }) createdBy?: string;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}
