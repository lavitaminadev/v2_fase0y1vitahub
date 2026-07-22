import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn,
  ManyToOne, JoinColumn,
} from 'typeorm';
import { Organization } from '../organizations/organization.entity';
import { Client } from '../clients/client.entity';
import { QuoteStatus } from './quote-status.enum';
import { Lead } from '../crm/leads/lead.entity';

@Entity('quotes')
export class Quote {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  @ManyToOne(() => Organization)
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;

  @Column({ name: 'client_id', type: 'uuid', nullable: true })
  clientId?: string;

  @ManyToOne(() => Client, { nullable: true })
  @JoinColumn({ name: 'client_id' })
  client?: Client;

  @Column({ name: 'lead_id', type: 'uuid', nullable: true }) leadId?: string;
  @ManyToOne(() => Lead, { nullable: true }) @JoinColumn({ name: 'lead_id' }) lead?: Lead;
  @Column({ type: 'int', default: 1 }) version: number;
  @Column({ name: 'parent_quote_id', type: 'uuid', nullable: true }) parentQuoteId?: string;
  @Column({ name: 'sent_at', type: 'timestamp', nullable: true }) sentAt?: Date;

  @Column({ type: 'varchar', length: 50, unique: true })
  number: string;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'decimal', precision: 18, scale: 2 })
  amount: number;

  @Column({ type: 'char', length: 3, default: 'CLP' })
  currency: string;

  @Column({ type: 'varchar', length: 50, default: QuoteStatus.DRAFT })
  status: QuoteStatus;

  @Column({ name: 'valid_until', type: 'date', nullable: true })
  validUntil?: Date;

  @Column({ name: 'accepted_at', type: 'timestamp', nullable: true })
  acceptedAt?: Date;

  @Column({ name: 'created_by', type: 'uuid' })
  createdBy: string;

  @Column({ type: 'json', nullable: true })
  items?: Record<string, any>[];

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
