import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('audit_logs')
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  @Column({ name: 'actor_id', type: 'uuid', nullable: true })
  actorId?: string | null;

  @Column({ name: 'entity_type', type: 'varchar', length: 100 })
  entityType: string;

  @Column({ name: 'entity_id', type: 'uuid', nullable: true })
  entityId?: string | null;

  @Column({ type: 'varchar', length: 50 })
  action: string;

  @Column({ type: 'json', nullable: true })
  before?: any;

  @Column({ type: 'json', nullable: true })
  after?: any;

  @Column({ type: 'text', nullable: true })
  reason?: string;

  @Column({ name: 'ip_address', type: 'varchar', length: 45, nullable: true })
  ipAddress?: string;

  @CreateDateColumn({ name: 'occurred_at' })
  occurredAt: Date;
}
