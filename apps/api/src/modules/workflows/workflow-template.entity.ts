import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export interface WorkflowStep {
  key: string;
  label: string;
  responsibleRole?: string;
  slaHours?: number;
  required: boolean;
}

@Entity('workflow_templates')
@Index('UQ_workflow_templates_org_code', ['organizationId', 'code'], { unique: true })
export class WorkflowTemplate {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'organization_id', type: 'uuid' }) organizationId: string;
  @Column({ type: 'varchar', length: 50 }) code: string;
  @Column({ type: 'varchar', length: 150 }) name: string;
  @Column({ type: 'text', nullable: true }) description?: string;
  @Column({ type: 'json' }) steps: WorkflowStep[];
  @Column({ name: 'is_active', type: 'boolean', default: true }) isActive: boolean;
  @Column({ type: 'int', default: 1 }) version: number;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}
