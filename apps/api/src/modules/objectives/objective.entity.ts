import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('objectives')
@Index('IDX_objectives_org_status', ['organizationId', 'status'])
export class Objective {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'organization_id', type: 'uuid' }) organizationId: string;
  @Column({ name: 'owner_id', type: 'uuid', nullable: true }) ownerId?: string;
  @Column({ name: 'client_id', type: 'uuid', nullable: true }) clientId?: string;
  @Column({ type: 'varchar', length: 30 }) category: string;
  @Column({ type: 'varchar', length: 255 }) title: string;
  @Column({ type: 'text', nullable: true }) description?: string;
  @Column({ type: 'varchar', length: 20, default: 'active' }) status: string;
  @Column({ type: 'tinyint', default: 0 }) progress: number;
  @Column({ name: 'due_at', type: 'date', nullable: true }) dueAt?: Date;
  @Column({ name: 'created_by', type: 'uuid' }) createdBy: string;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}
