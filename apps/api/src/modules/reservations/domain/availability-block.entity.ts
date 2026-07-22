import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('reservation_availability_blocks')
@Index('IDX_reservation_blocks_form_range', ['formId', 'startsAt', 'endsAt'])
export class AvailabilityBlock {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'organization_id', type: 'uuid' }) organizationId: string;
  @Column({ name: 'client_id', type: 'uuid' }) clientId: string;
  @Column({ name: 'form_id', type: 'uuid' }) formId: string;
  @Column({ name: 'starts_at', type: 'timestamp' }) startsAt: Date;
  @Column({ name: 'ends_at', type: 'timestamp' }) endsAt: Date;
  @Column({ type: 'varchar', length: 180, nullable: true }) reason?: string;
  @Column({ name: 'created_by', type: 'uuid' }) createdBy: string;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
}
