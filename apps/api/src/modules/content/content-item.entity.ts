import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn,
  ManyToOne, JoinColumn,
} from 'typeorm';
import { ContentGrid } from './content-grid.entity';
import { ContentItemType } from './content-item-type.enum';
import { ContentItemStatus } from './content-item-status.enum';

@Entity('content_items')
export class ContentItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'content_grid_id', type: 'uuid' })
  contentGridId: string;

  @ManyToOne(() => ContentGrid, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'content_grid_id' })
  contentGrid: ContentGrid;

  @Column({ type: 'varchar', length: 50 })
  type: ContentItemType;

  @Column({ type: 'varchar', length: 255 })
  caption: string;

  @Column({ type: 'varchar', length: 50, default: ContentItemStatus.PLANNED })
  status: ContentItemStatus;

  @Column({ name: 'scheduled_at', type: 'date', nullable: true })
  scheduledAt?: Date;

  @Column({ name: 'piece_id', type: 'uuid', nullable: true })
  pieceId?: string;

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
