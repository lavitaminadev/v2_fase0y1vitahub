import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('charge_notes')
@Index('UQ_charge_notes_correction', ['correctionId'], { unique: true })
export class ChargeNote {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'organization_id', type: 'uuid' }) organizationId: string;
  @Column({ name: 'client_id', type: 'uuid' }) clientId: string;
  @Column({ name: 'piece_id', type: 'uuid' }) pieceId: string;
  @Column({ name: 'correction_id', type: 'uuid' }) correctionId: string;
  @Column({ type: 'varchar', length: 30, default: 'pending_pricing' }) status: string;
  @Column({ type: 'decimal', precision: 18, scale: 2, nullable: true }) amount?: number;
  @Column({ type: 'char', length: 3, default: 'CLP' }) currency: string;
  @Column({ type: 'text' }) reason: string;
  @Column({ name: 'invoice_id', type: 'uuid', nullable: true }) invoiceId?: string;
  @Column({ name: 'created_by', type: 'uuid', nullable: true }) createdBy?: string;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}
