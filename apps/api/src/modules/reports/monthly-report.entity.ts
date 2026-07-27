import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('monthly_reports')
@Index('UQ_monthly_reports_client_period', ['clientId', 'year', 'month'], { unique: true })
export class MonthlyReport {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'organization_id', type: 'uuid' }) organizationId: string;
  @Column({ name: 'client_id', type: 'uuid' }) clientId: string;
  @Column({ type: 'smallint' }) year: number;
  @Column({ type: 'tinyint' }) month: number;
  @Column({ type: 'varchar', length: 255 }) title: string;
  @Column({ type: 'varchar', length: 20, default: 'draft' }) status: string;
  @Column({ name: 'executive_summary', type: 'text', nullable: true }) executiveSummary?: string;
  @Column({ type: 'json' }) metrics: Record<string, number>;
  @Column({ type: 'json', nullable: true }) insights?: string[];
  @Column({ type: 'text', nullable: true }) recommendations?: string;
  @Column({ name: 'sales_generated', type: 'decimal', precision: 18, scale: 2, default: 0 }) salesGenerated: number;
  @Column({ name: 'ad_spend', type: 'decimal', precision: 18, scale: 2, default: 0 }) adSpend: number;
  @Column({ type: 'int', default: 0 }) leads: number;
  @Column({ type: 'int', default: 0 }) bookings: number;
  @Column({ type: 'int', default: 0 }) conversions: number;
  @Column({ name: 'created_by', type: 'uuid' }) createdBy: string;
  @Column({ name: 'published_by', type: 'uuid', nullable: true }) publishedBy?: string;
  @Column({ name: 'published_at', type: 'timestamp', nullable: true }) publishedAt?: Date;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}
