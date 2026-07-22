import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('integration_metrics')
@Index('UQ_integration_metric_daily', ['provider', 'externalAccountId', 'clientId', 'metricDate'], { unique: true })
export class IntegrationMetric {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'organization_id', type: 'uuid' }) organizationId: string;
  @Column({ name: 'client_id', type: 'uuid' }) clientId: string;
  @Column({ type: 'varchar', length: 30 }) provider: string;
  @Column({ name: 'external_account_id', type: 'varchar', length: 255 }) externalAccountId: string;
  @Column({ name: 'metric_date', type: 'date' }) metricDate: Date;
  @Column({ type: 'decimal', precision: 18, scale: 2, default: 0 }) spend: number;
  @Column({ type: 'bigint', default: 0 }) impressions: number;
  @Column({ type: 'bigint', default: 0 }) reach: number;
  @Column({ type: 'bigint', default: 0 }) clicks: number;
  @Column({ type: 'decimal', precision: 18, scale: 4, default: 0 }) conversions: number;
  @Column({ type: 'decimal', precision: 18, scale: 4, default: 0 }) leads: number;
  @Column({ type: 'json', nullable: true }) breakdown?: Record<string, any>;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}
