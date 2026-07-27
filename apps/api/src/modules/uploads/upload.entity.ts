import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn,
} from 'typeorm';
import { Organization } from '../organizations/organization.entity';

@Entity('uploads')
export class Upload {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'organization_id', type: 'uuid' }) organizationId: string;
  @ManyToOne(() => Organization, { onDelete: 'CASCADE' }) @JoinColumn({ name: 'organization_id' }) organization: Organization;
  @Column({ name: 'file_name', type: 'varchar', length: 255 }) fileName: string;
  @Column({ name: 'original_name', type: 'varchar', length: 255 }) originalName: string;
  @Column({ name: 'mime_type', type: 'varchar', length: 100 }) mimeType: string;
  @Column({ type: 'int' }) size: number;
  @Column({ type: 'varchar', length: 500 }) path: string;
  @Column({ name: 'drive_file_id', type: 'varchar', length: 255, nullable: true }) driveFileId?: string;
  @Column({ name: 'uploaded_by', type: 'uuid' }) uploadedBy: string;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
}
