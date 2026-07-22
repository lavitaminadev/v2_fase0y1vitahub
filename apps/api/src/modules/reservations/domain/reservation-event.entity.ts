import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('reservation_events')
@Index('IDX_reservation_events_reservation', ['reservationId', 'createdAt'])
export class ReservationEvent {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'organization_id', type: 'uuid' }) organizationId: string;
  @Column({ name: 'client_id', type: 'uuid' }) clientId: string;
  @Column({ name: 'reservation_id', type: 'uuid' }) reservationId: string;
  @Column({ type: 'varchar', length: 40 }) type: string;
  @Column({ name: 'from_status', type: 'varchar', length: 24, nullable: true }) fromStatus?: string;
  @Column({ name: 'to_status', type: 'varchar', length: 24, nullable: true }) toStatus?: string;
  @Column({ name: 'actor_id', type: 'uuid', nullable: true }) actorId?: string;
  @Column({ name: 'actor_type', type: 'varchar', length: 20, default: 'system' }) actorType: string;
  @Column({ type: 'json', nullable: true }) metadata?: Record<string, unknown>;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
}
