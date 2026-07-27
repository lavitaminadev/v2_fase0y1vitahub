import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn,
  ManyToOne, JoinColumn, OneToMany,
} from 'typeorm';
import { Organization } from '../organizations/organization.entity';
import { Client } from '../clients/client.entity';
import { ContentGridStatus } from './content-grid-status.enum';
import { ContentItem } from './content-item.entity';

@Entity('content_grids')
export class ContentGrid {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  @ManyToOne(() => Organization)
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;

  @Column({ name: 'client_id', type: 'uuid' })
  clientId: string;

  @ManyToOne(() => Client, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'client_id' })
  client: Client;

  @OneToMany(() => ContentItem, (item) => item.contentGrid)
  contentItems: ContentItem[];

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ name: 'week_start', type: 'date' })
  weekStart: Date;

  @Column({ name: 'week_end', type: 'date' })
  weekEnd: Date;

  @Column({ type: 'varchar', length: 50, default: ContentGridStatus.DRAFT })
  status: ContentGridStatus;

  @Column({ name: 'notes', type: 'text', nullable: true })
  notes?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
