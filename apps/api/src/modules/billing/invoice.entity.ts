import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn,
  ManyToOne, JoinColumn, Index,
} from 'typeorm';
import { Organization } from '../organizations/organization.entity';
import { Client } from '../clients/client.entity';

@Entity('invoices')
@Index('UQ_invoices_org_number', ['organizationId', 'number'], { unique: true })
export class Invoice {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  @ManyToOne(() => Organization)
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;

  @Column({ name: 'client_id', type: 'uuid' })
  clientId: string;

  @ManyToOne(() => Client)
  @JoinColumn({ name: 'client_id' })
  client: Client;

  @Column({ type: 'varchar', length: 50 })
  number: string;

  @Column({ name: 'issued_at', type: 'date' })
  issuedAt: Date;

  @Column({ name: 'due_at', type: 'date' })
  dueAt: Date;

  @Column({ name: 'paid_at', type: 'timestamp', nullable: true })
  paidAt?: Date;

  @Column({ name: 'subtotal', type: 'decimal', precision: 18, scale: 2 })
  subtotal: number;

  @Column({ name: 'tax', type: 'decimal', precision: 18, scale: 2, default: 0 })
  tax: number;

  @Column({ name: 'total', type: 'decimal', precision: 18, scale: 2 })
  total: number;

  @Column({ type: 'char', length: 3, default: 'CLP' })
  currency: string;

  @Column({ type: 'varchar', length: 20, default: 'pending' })
  status: string;

  @Column({ name: 'notes', type: 'text', nullable: true })
  notes?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
