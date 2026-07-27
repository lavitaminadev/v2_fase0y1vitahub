import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn,
  ManyToOne, JoinColumn,
} from 'typeorm';
import { Organization } from '../organizations/organization.entity';
import { ServiceCategory } from './service-category.enum';
import { ServiceStatus } from './service-status.enum';

@Entity('services')
export class Service {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  @ManyToOne(() => Organization)
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'varchar', length: 50 })
  category: ServiceCategory;

  @Column({ name: 'unit_price', type: 'decimal', precision: 18, scale: 2, nullable: true })
  unitPrice?: number;

  @Column({ type: 'char', length: 3, default: 'CLP' })
  currency: string;

  @Column({ name: 'ud_per_unit', type: 'decimal', precision: 8, scale: 2, default: 0 })
  udPerUnit: number;

  @Column({ type: 'varchar', length: 50, default: ServiceStatus.ACTIVE })
  status: ServiceStatus;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
