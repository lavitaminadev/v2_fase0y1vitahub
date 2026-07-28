import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('reservation_coupons')
@Index('UQ_reservation_coupons_code_org', ['code', 'organizationId'], { unique: true })
export class ReservationCoupon {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'organization_id', type: 'uuid' }) organizationId: string;
  @Column({ name: 'client_id', type: 'uuid', nullable: true }) clientId?: string;
  @Column({ type: 'varchar', length: 80 }) code: string;
  @Column({ name: 'discount_type', type: 'varchar', length: 20, default: 'percentage' }) discountType: string;
  @Column({ type: 'smallint', default: 0 }) value: number;
  @Column({ name: 'max_uses', type: 'int', default: 0 }) maxUses: number;
  @Column({ name: 'usage_count', type: 'int', default: 0 }) usageCount: number;
  @Column({ name: 'valid_from', type: 'timestamp', nullable: true }) validFrom?: Date;
  @Column({ name: 'valid_until', type: 'timestamp', nullable: true }) validUntil?: Date;
  @Column({ name: 'form_ids', type: 'json', nullable: true }) formIds?: string[];
  @Column({ name: 'valid_days_of_week', type: 'json', nullable: true }) validDaysOfWeek?: number[];
  /**
   * Franja horaria de la reserva en la que el cupón aplica, en formato `HH:MM` y en la zona
   * horaria del formulario. Ambas nulas = cualquier hora.
   */
  @Column({ name: 'valid_from_time', type: 'varchar', length: 5, nullable: true }) validFromTime?: string;
  @Column({ name: 'valid_until_time', type: 'varchar', length: 5, nullable: true }) validUntilTime?: string;
  @Column({ type: 'boolean', default: true }) active: boolean;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}
